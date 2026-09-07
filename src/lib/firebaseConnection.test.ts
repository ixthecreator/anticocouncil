import { expect, test } from "bun:test";
import {
  newCollectionConnection,
  receiveCollectionSnapshot,
  resolveFirebaseConfiguration,
  summarizeCloudConnection,
} from "./firebaseConnection";

const metadata = (fromCache = false, hasPendingWrites = false) => ({ fromCache, hasPendingWrites });
const server = () => receiveCollectionSnapshot(newCollectionConnection(), metadata());

test("eight empty cache snapshots cannot establish a cloud connection", () => {
  const caches = Array.from({ length: 8 }, () => receiveCollectionSnapshot(newCollectionConnection(), metadata(true)));
  expect(summarizeCloudConnection(caches).ready).toBe(false);
  expect(summarizeCloudConnection(caches).connection).toBe("connecting");
  expect(summarizeCloudConnection(caches, false, true).connection).toBe("offline");
});

test("every collection must have a valid server snapshot, including empty collections", () => {
  const states = Array.from({ length: 8 }, server);
  states[7] = newCollectionConnection();
  expect(summarizeCloudConnection(states).ready).toBe(false);
  states[7] = receiveCollectionSnapshot(states[7], metadata());
  expect(summarizeCloudConnection(states).ready).toBe(true);
});

test("a healthy collection update cannot conceal another collection's listener error", () => {
  const states = [server(), { ...server(), error: "permission-denied" }];
  states[0] = receiveCollectionSnapshot(states[0], metadata());
  const result = summarizeCloudConnection(states);
  expect(result.connection).toBe("error");
  expect(result.ready).toBe(false);
  expect(result.error).toBe("permission-denied");
});

test("invalid snapshots keep writes blocked until that collection is validated again", () => {
  const invalid = { ...server(), error: "数据格式不兼容" };
  expect(summarizeCloudConnection([invalid, server()]).ready).toBe(false);
  const repaired = receiveCollectionSnapshot(invalid, metadata());
  expect(summarizeCloudConnection([repaired, server()]).ready).toBe(true);
});

test("metadata-only acknowledgment distinguishes queued writes from saved server data", () => {
  const queued = receiveCollectionSnapshot(server(), metadata(false, true));
  expect(summarizeCloudConnection([queued]).hasPendingWrites).toBe(true);
  expect(summarizeCloudConnection([queued]).ready).toBe(false);
  const acknowledged = receiveCollectionSnapshot(queued, metadata(false, false));
  expect(summarizeCloudConnection([acknowledged]).ready).toBe(true);
});

test("disconnect revokes readiness and a late server recovery clears the connection timeout", () => {
  const confirmed = server();
  expect(summarizeCloudConnection([confirmed], true).ready).toBe(false);
  const stale = receiveCollectionSnapshot(confirmed, metadata(true));
  expect(summarizeCloudConnection([stale]).connection).toBe("offline");
  const recovered = receiveCollectionSnapshot(stale, metadata());
  expect(summarizeCloudConnection([recovered], false, true)).toMatchObject({ connection: "connected", ready: true, error: "" });
});

test("missing or partial self-owned Firebase configuration never falls back to the original project", () => {
  expect(resolveFirebaseConfiguration({})).toMatchObject({ config: null, databaseId: "(default)" });
  const partial = resolveFirebaseConfiguration({ VITE_FIREBASE_PROJECT_ID: "my-meetings" });
  expect(partial.config).toBeNull();
  expect(partial.error).toContain("VITE_FIREBASE_API_KEY");
  expect(partial.error).toContain("VITE_FIREBASE_APP_ID");
});

const configured = {
  VITE_FIREBASE_PROJECT_ID: "my-meetings",
  VITE_FIREBASE_API_KEY: "test-api-key",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
};

test("new projects default to their default database while explicit named databases are retained", () => {
  const defaults = resolveFirebaseConfiguration(configured);
  expect(defaults.error).toBe("");
  expect(defaults.databaseId).toBe("(default)");
  expect(defaults.config?.authDomain).toBe("my-meetings.firebaseapp.com");
  expect(resolveFirebaseConfiguration({ ...configured, VITE_FIREBASE_DATABASE_ID: "council" }).databaseId).toBe("council");
  expect(resolveFirebaseConfiguration({ ...configured, VITE_FIRESTORE_DATABASE_ID: "legacy-name" }).databaseId).toBe("legacy-name");
  expect(resolveFirebaseConfiguration({ ...configured, VITE_FIREBASE_DATABASE_ID: "bad/path" }).config).toBeNull();
});
