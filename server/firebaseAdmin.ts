import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import type { App, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Auth } from "firebase-admin/auth";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { createVotingService, VotingError } from "./votingService";
import type { VotingStore } from "./votingService";
import type { VotingHttpDependencies } from "./votingHttp";

function unavailable(): never {
  throw new VotingError(503, "service-unavailable", "投票服务暂未就绪，请联系管理员。");
}

/** Validate project isolation without exposing configuration or credential values in errors. */
export function votingFirebaseConfiguration(env: NodeJS.ProcessEnv) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) unavailable();
  const databaseId = env.VITE_FIREBASE_DATABASE_ID || env.VITE_FIRESTORE_DATABASE_ID || "(default)";
  if (!/^(\(default\)|[a-zA-Z0-9][a-zA-Z0-9-]*)$/.test(databaseId)) unavailable();
  for (const configuredProject of [env.GOOGLE_CLOUD_PROJECT, env.GCLOUD_PROJECT]) {
    if (configuredProject && configuredProject !== projectId) unavailable();
  }
  let serviceAccount: ServiceAccount | undefined;
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const raw = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (!raw || typeof raw !== "object" || raw.type !== "service_account" ||
        raw.project_id !== projectId || typeof raw.client_email !== "string" ||
        !raw.client_email.endsWith(".iam.gserviceaccount.com") || typeof raw.private_key !== "string" ||
        !raw.private_key.includes("-----BEGIN PRIVATE KEY-----")) unavailable();
      serviceAccount = { projectId: raw.project_id, clientEmail: raw.client_email, privateKey: raw.private_key };
    } catch { unavailable(); }
  }
  return { projectId, databaseId, serviceAccount };
}

let dependencies: VotingHttpDependencies | undefined;

export function createVotingTokenVerifier(auth: Pick<Auth, "verifyIdToken">): VotingHttpDependencies["verifyToken"] {
  return async (token) => {
    try {
      // checkRevoked also rejects disabled accounts; never trust a client-supplied UID or email.
      const identity = await auth.verifyIdToken(token, true);
      return { uid: identity.uid, email: identity.email || "", emailVerified: identity.email_verified === true };
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : "";
      if (["auth/argument-error", "auth/invalid-argument", "auth/id-token-expired", "auth/id-token-revoked",
        "auth/invalid-id-token", "auth/user-disabled", "auth/user-not-found"].includes(code as string))
        throw new VotingError(401, "unauthenticated", "登录状态已失效，请重新登录。");
      return unavailable();
    }
  };
}

/** Lazy initialization keeps credentials out of the Vite build and client bundles. */
export function getVotingDependencies(): VotingHttpDependencies {
  if (dependencies) return dependencies;
  try {
    const configuration = votingFirebaseConfiguration(process.env);
    const name = `private-voting-${configuration.projectId}`;
    let app: App = getApps().find((candidate) => candidate.name === name);
    if (app && app.options.projectId !== configuration.projectId) unavailable();
    if (!app) app = initializeApp({
      projectId: configuration.projectId,
      credential: configuration.serviceAccount ? cert(configuration.serviceAccount) : applicationDefault(),
    }, name);
    const firestore = getFirestore(app, configuration.databaseId);
    const store: VotingStore = {
      runTransaction: (operation) => firestore.runTransaction(async (transaction) => operation({
        get: async (path) => {
          const document = await transaction.get(firestore.doc(path));
          return document.exists ? document.data() : null;
        },
        hasMatchingDocument: async (collection, field, value) => {
          const snapshot = await transaction.get(firestore.collection(collection).where(field, "==", value).limit(1));
          return !snapshot.empty;
        },
        create: (path, data) => { transaction.create(firestore.doc(path), data); },
        update: (path, data, deleteFields = []) => {
          const patch = { ...data };
          for (const field of deleteFields) patch[field] = FieldValue.delete();
          // Use literal field paths: an old imported key containing a dot must be removed
          // as that exact top-level field, not interpreted as a nested map path.
          const [first, ...remaining] = Object.entries(patch);
          if (first) transaction.update(firestore.doc(path), new FieldPath(first[0]), first[1],
            ...remaining.flatMap(([field, value]) => [new FieldPath(field), value]));
        },
        delete: (path) => { transaction.delete(firestore.doc(path)); },
      })),
    };
    const auth = getAuth(app);
    dependencies = {
      service: createVotingService({ store, now: () => new Date(), newRoundId: randomUUID }),
      verifyToken: createVotingTokenVerifier(auth),
    };
    return dependencies;
  } catch { return unavailable(); }
}
