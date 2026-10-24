import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as firestore from "firebase/firestore";
import * as firebaseConfig from "./firebase";
import { watchOwnWorkspaceAccess, watchWorkspaceMembership } from "./cloudAccess";

afterEach(() => mock.restore());

type Metadata = { fromCache: boolean; hasPendingWrites: boolean };
interface Listener { options: unknown; next: (snapshot: unknown) => void; error: (error: unknown) => void; stop: ReturnType<typeof mock>; }
function database() {
  const listeners = new Map<string, Listener>();
  spyOn(firebaseConfig, "getDatabase").mockReturnValue({} as never);
  const reference = ((_database: unknown, ...path: string[]) => ({ path: path.join("/") })) as never;
  spyOn(firestore, "doc").mockImplementation(reference);
  spyOn(firestore, "collection").mockImplementation(reference);
  spyOn(firestore, "onSnapshot").mockImplementation(((ref: { path: string }, options: unknown, next: Listener["next"], error: Listener["error"]) => {
    const stop = mock(() => {});
    listeners.set(ref.path, { options, next, error, stop });
    return stop;
  }) as never);
  return (path: string) => listeners.get(path)!;
}
const server: Metadata = { fromCache: false, hasPendingWrites: false };
const record = (id: string, data: unknown, metadata = server) => ({ id, exists: () => data !== undefined, data: () => data, metadata });
const records = (rows: Record<string, unknown>, metadata = server) => ({ docs: Object.entries(rows).map(([id, data]) => ({ id, data: () => data })), metadata });
const member = { name: "Alice", email: "alice@example.com", role: "member", active: true };
const ownListener = () => ({ access: mock(), accessError: mock(), request: mock(), requestError: mock() });

test("own access is confirmed only by the server, never by a cache or a pending local write", () => {
  const listener = database();
  const own = ownListener();
  watchOwnWorkspaceAccess("alice", own);
  const access = listener("workspaceAccess/alice");
  expect(access.options).toEqual({ includeMetadataChanges: true });
  access.next(record("alice", member, { fromCache: true, hasPendingWrites: false }));
  access.next(record("alice", member, { fromCache: false, hasPendingWrites: true }));
  access.next(record("alice", member));
  access.next(record("alice", { ...member, role: "owner" }));
  access.next(record("alice", undefined));
  expect(own.access.mock.calls).toEqual([
    [null, false], [null, false], [{ uid: "alice", ...member }, true], [null, true], [null, true],
  ]);
});

test("a join request is reported only from the server, and both listeners stop together", () => {
  const listener = database();
  const own = ownListener();
  const stop = watchOwnWorkspaceAccess("alice", own);
  const request = listener("accessRequests/alice");
  request.next(record("alice", { name: "Alice", email: "alice@example.com" }, { fromCache: true, hasPendingWrites: false }));
  request.next(record("alice", { name: "Alice", email: "alice@example.com" }));
  request.next(record("alice", undefined));
  expect(own.request.mock.calls).toEqual([[{ uid: "alice", name: "Alice", email: "alice@example.com" }], [null]]);
  const failure = { code: "permission-denied" };
  listener("workspaceAccess/alice").error(failure);
  request.error(failure);
  expect(own.accessError).toHaveBeenCalledWith(failure);
  expect(own.requestError).toHaveBeenCalledWith(failure);
  stop();
  expect(listener("workspaceAccess/alice").stop).toHaveBeenCalledTimes(1);
  expect(request.stop).toHaveBeenCalledTimes(1);
});

test("member management ignores cached lists and drops malformed records", () => {
  const listener = database();
  const updates = { members: mock(), requests: mock(), error: mock() };
  const stop = watchWorkspaceMembership(updates);
  const members = listener("workspaceAccess");
  const requests = listener("accessRequests");
  expect(members.options).toEqual({ includeMetadataChanges: true });
  members.next(records({ alice: member }, { fromCache: true, hasPendingWrites: false }));
  members.next(records({ alice: member, broken: { name: "Broken" } }));
  requests.next(records({ bob: { name: "Bob", email: "bob@example.com" } }, { fromCache: true, hasPendingWrites: false }));
  requests.next(records({ bob: { name: "Bob", email: "bob@example.com" }, broken: { name: "Broken" } }));
  expect(updates.members.mock.calls).toEqual([[[{ uid: "alice", ...member }]]]);
  expect(updates.requests.mock.calls).toEqual([[[{ uid: "bob", name: "Bob", email: "bob@example.com" }]]]);
  const failure = { code: "permission-denied" };
  requests.error(failure);
  expect(updates.error).toHaveBeenCalledWith(failure);
  stop();
  expect(members.stop).toHaveBeenCalledTimes(1);
  expect(requests.stop).toHaveBeenCalledTimes(1);
});
