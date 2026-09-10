import { afterEach, expect, mock, spyOn, test } from "bun:test";
import type { Auth, User } from "firebase/auth";
import * as cloudAccess from "./cloudAccess";
import { votingRequest } from "./privateVoting";
import { createWriteSession } from "./workspacePersistence";

afterEach(() => mock.restore());
function authenticated(token: () => Promise<string> = async () => "test-token") {
  const user = { uid: "member", getIdToken: mock(token) } as unknown as User;
  const auth = { currentUser: user } as Auth;
  spyOn(cloudAccess, "getCloudAuth").mockReturnValue(auth);
  const fetch = spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  return { user, auth, fetch };
}

test("unmounting with the same UID while a token is pending prevents the mutation request", async () => {
  let finish!: (token: string) => void;
  const sdk = authenticated(() => new Promise(resolve => { finish = resolve; }));
  const session = createWriteSession(() => sdk.auth.currentUser?.uid || null);
  session.activate();
  const request = votingRequest({ action: "start", issueId: "issue", rule: "simple" }, { expectedUid: "member", assertCurrent: session.capture() });
  session.deactivate();
  finish("old-token");
  await expect(request).rejects.toThrow("工作区已关闭");
  expect(sdk.auth.currentUser).toBe(sdk.user);
  expect(sdk.fetch).not.toHaveBeenCalled();
});

test("an account change before or during token retrieval cannot send a request", async () => {
  let finish!: (token: string) => void;
  const sdk = authenticated(() => new Promise(resolve => { finish = resolve; }));
  await expect(votingRequest({ action: "cast", issueId: "issue", choice: "approve" }, { expectedUid: "other" })).rejects.toThrow("登录账号已改变");
  expect(sdk.user.getIdToken).not.toHaveBeenCalled();
  const request = votingRequest({ action: "cast", issueId: "issue", choice: "approve" }, { expectedUid: "member" });
  (sdk.auth as { currentUser: User | null }).currentUser = { uid: "new-member" } as User;
  finish("old-token");
  await expect(request).rejects.toThrow("账号已改变");
  expect(sdk.fetch).not.toHaveBeenCalled();
});

test("a receipt finishing after account change is not returned to the new account", async () => {
  const sdk = authenticated();
  let finish!: (value: unknown) => void;
  let bodyStarted!: () => void;
  const readingBody = new Promise<void>(resolve => { bodyStarted = resolve; });
  sdk.fetch.mockResolvedValue({ ok: true, json: () => { bodyStarted(); return new Promise(resolve => { finish = resolve; }); } } as Response);
  const request = votingRequest({ action: "my-ballot", issueId: "issue", roundId: "round" });
  await readingBody;
  (sdk.auth as { currentUser: User | null }).currentUser = { uid: "other" } as User;
  finish({ ok: true, ballot: { choice: "approve", createdAt: "2026-09-10" } });
  await expect(request).rejects.toThrow("账号已改变");
});

test("HTTP 503 and malformed responses fail explicitly instead of yielding a success receipt", async () => {
  const sdk = authenticated();
  sdk.fetch.mockResolvedValue(new Response("Service temporarily unavailable", { status: 503 }));
  await expect(votingRequest({ action: "cast", issueId: "issue", roundId: "round", choice: "reject" })).rejects.toThrow("表决服务暂不可用");
  sdk.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { message: "表决已关闭。" } }), { status: 409 }));
  await expect(votingRequest({ action: "cast", issueId: "issue", roundId: "round", choice: "reject" })).rejects.toThrow("表决已关闭");
  sdk.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { message: { token: "must-not-display" } } }), { status: 503 }));
  await expect(votingRequest({ action: "cast", issueId: "issue", roundId: "round", choice: "reject" })).rejects.toThrow("表决服务暂不可用");
});

test("the own-ballot GET includes only its issue and round, uses authentication, and disables caching", async () => {
  const sdk = authenticated();
  sdk.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, ballot: null }), { status: 200 }));
  await expect(votingRequest({ action: "my-ballot", issueId: "事项 & 一", roundId: "round/1", uid: "another-member", memberId: "another-member", otherUid: "another-member" })).resolves.toMatchObject({ ballot: null });
  const [url, options] = sdk.fetch.mock.calls[0];
  const target = new URL(String(url), "https://example.test");
  expect(target.pathname).toBe("/api/voting");
  expect([...target.searchParams.entries()]).toEqual([["action", "my-ballot"], ["issueId", "事项 & 一"], ["roundId", "round/1"]]);
  expect(options).toMatchObject({ method: "GET", cache: "no-store", headers: { Authorization: "Bearer test-token" } });
  expect(options?.body).toBeUndefined();
});

test("an already aborted request does not read a token or contact the API", async () => {
  const sdk = authenticated();
  const controller = new AbortController();
  controller.abort();
  await expect(votingRequest({ action: "my-ballot", issueId: "issue", roundId: "round" }, { signal: controller.signal })).rejects.toThrow("操作已取消");
  expect(sdk.user.getIdToken).not.toHaveBeenCalled();
  expect(sdk.fetch).not.toHaveBeenCalled();
});
