import { expect, test } from "bun:test";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { createVotingTokenVerifier, votingFirebaseConfiguration } from "./firebaseAdmin";
import { VotingError } from "./votingService";

const account = { type: "service_account", project_id: "antico-council",
  client_email: "voting@antico-council.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nTEST ONLY\n-----END PRIVATE KEY-----\n" };

test("server uses the same explicit project and database as the client", () => {
  expect(votingFirebaseConfiguration({ VITE_FIREBASE_PROJECT_ID: "antico-council" }))
    .toEqual({ projectId: "antico-council", databaseId: "(default)", serviceAccount: undefined });
  expect(votingFirebaseConfiguration({ VITE_FIREBASE_PROJECT_ID: "antico-council", VITE_FIRESTORE_DATABASE_ID: "named-db" }).databaseId).toBe("named-db");
  expect(votingFirebaseConfiguration({ VITE_FIREBASE_PROJECT_ID: "antico-council", FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account) }).serviceAccount.projectId).toBe("antico-council");
});

test.each([
  {}, { VITE_FIREBASE_PROJECT_ID: "../other" },
  { VITE_FIREBASE_PROJECT_ID: "antico-council", GOOGLE_CLOUD_PROJECT: "other-project" },
  { VITE_FIREBASE_PROJECT_ID: "antico-council", GCLOUD_PROJECT: "other-project" },
  { VITE_FIREBASE_PROJECT_ID: "antico-council", VITE_FIREBASE_DATABASE_ID: "database/other" },
  { VITE_FIREBASE_PROJECT_ID: "antico-council", FIREBASE_SERVICE_ACCOUNT_JSON: "bad secret JSON" },
  { VITE_FIREBASE_PROJECT_ID: "antico-council", FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ ...account, project_id: "wrong-project" }) },
])("unsafe config fails without exposing supplied values", (env) => {
  try { votingFirebaseConfiguration(env); throw new Error("Expected rejection"); }
  catch (error) {
    expect(error).toBeInstanceOf(VotingError);
    expect((error as VotingError).status).toBe(503);
    expect((error as Error).message).not.toMatch(/secret|wrong-project|PRIVATE KEY|other-project/);
  }
});

test("token verification checks revocation and returns only verified identity fields", async () => {
  const calls: unknown[][] = [];
  const verifyIdToken: Auth["verifyIdToken"] = async (...args) => {
    calls.push(args);
    return { uid: "firebase-uid", email: "user@example.com", email_verified: true, customClaim: "not-forwarded" } as unknown as DecodedIdToken;
  };
  expect(await createVotingTokenVerifier({ verifyIdToken })("token"))
    .toEqual({ uid: "firebase-uid", email: "user@example.com", emailVerified: true });
  expect(calls).toEqual([["token", true]]);
});

test.each(["auth/id-token-revoked", "auth/id-token-expired", "auth/user-disabled", "auth/user-not-found"])("%s is a safe login failure", async (code) => {
  const verifier = createVotingTokenVerifier({ verifyIdToken: async () => { throw { code, message: "sensitive SDK details" }; } });
  try { await verifier("token"); throw new Error("Expected rejection"); }
  catch (error) {
    expect(error).toBeInstanceOf(VotingError);
    expect((error as VotingError).status).toBe(401);
    expect((error as Error).message).not.toContain("sensitive");
  }
});

test("credential or upstream failures are service errors, not a request to keep logging in", async () => {
  const verifier = createVotingTokenVerifier({ verifyIdToken: async () => { throw { code: "auth/insufficient-permission", message: "PRIVATE KEY" }; } });
  try { await verifier("token"); throw new Error("Expected rejection"); }
  catch (error) {
    expect((error as VotingError).status).toBe(503);
    expect((error as Error).message).not.toContain("PRIVATE KEY");
  }
});
