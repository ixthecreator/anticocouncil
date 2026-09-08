import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as firebaseAuth from "firebase/auth";
import type { Auth, User, UserCredential } from "firebase/auth";
import { completeGoogleRedirect, hasWorkspaceAccess, observeCloudAuthentication, type CloudAuthenticationState } from "./cloudAccess";

afterEach(() => mock.restore());

function authentication(readResult: () => Promise<UserCredential | null>) {
  const auth = {} as Auth;
  const listeners: Array<(user: User | null) => void | Promise<void>> = [];
  const stops: number[] = [];
  const read = spyOn(firebaseAuth, "getRedirectResult").mockImplementation(readResult);
  spyOn(firebaseAuth, "onIdTokenChanged").mockImplementation((_auth, next) => {
    const index = listeners.length;
    listeners.push(next as (user: User | null) => void | Promise<void>);
    return () => { stops.push(index); };
  });
  return { auth, listeners, stops, read };
}

const user = (uid: string, verified = true): User => ({
  uid, displayName: uid,
  getIdTokenResult: async () => ({ claims: { email: `${uid}@example.com`, email_verified: verified } }),
}) as unknown as User;

test("a redirect failure reaches the gate and cannot be erased by later token or anonymous events", async () => {
  const sdk = authentication(async () => { throw { code: "auth/unauthorized-domain" }; });
  const states: CloudAuthenticationState[] = [];
  const stop = observeCloudAuthentication(sdk.auth, state => states.push(state));
  await sdk.listeners[0](null);
  expect(states.at(-1)?.ready).toBe(false);
  await completeGoogleRedirect(sdk.auth).catch(() => {});
  expect(states.at(-1)?.ready).toBe(true);
  expect(states.at(-1)?.redirectError).toContain("Google 登录未完成");
  expect(states.at(-1)?.redirectError).toContain("授权域名");
  await sdk.listeners[0](user("applicant"));
  expect(states.at(-1)?.redirectError).toContain("授权域名");
  expect(hasWorkspaceAccess(states.at(-1)!.identity, null)).toBe(false);
  await sdk.listeners[0](null);
  expect(states.at(-1)?.redirectError).toContain("授权域名");
  stop();
});

test("strict-mode remounts share one redirect consumption including its rejection", async () => {
  const warning = spyOn(console, "warn").mockImplementation(() => {});
  let rejectResult!: (reason: unknown) => void;
  const pending = new Promise<UserCredential | null>((_resolve, reject) => { rejectResult = reject; });
  const sdk = authentication(() => pending);
  const abandoned: CloudAuthenticationState[] = [];
  const current: CloudAuthenticationState[] = [];
  const first = observeCloudAuthentication(sdk.auth, state => abandoned.push(state));
  first();
  const abandonedCount = abandoned.length;
  const second = observeCloudAuthentication(sdk.auth, state => current.push(state));
  await sdk.listeners[1](null);
  rejectResult({ code: "auth/network-request-failed" });
  await completeGoogleRedirect(sdk.auth).catch(() => {});
  expect(sdk.read).toHaveBeenCalledTimes(1);
  expect(abandoned.length).toBe(abandonedCount);
  expect(current.at(-1)?.redirectError).toContain("无法连接登录服务");
  expect(current.at(-1)?.ready).toBe(true);
  expect(warning).toHaveBeenCalledTimes(1);
  expect(warning.mock.calls[0]).toEqual(["Firebase Google login diagnostic", { phase: "google-redirect-result", code: "auth/network-request-failed", cause: "no-sdk-message" }]);
  second();
  expect(sdk.stops).toEqual([0, 1]);
});

test("redirect credentials alone never authenticate the gate or approve a member", async () => {
  const applicant = user("applicant");
  const sdk = authentication(async () => ({ user: applicant }) as UserCredential);
  const states: CloudAuthenticationState[] = [];
  const stop = observeCloudAuthentication(sdk.auth, state => states.push(state));
  await completeGoogleRedirect(sdk.auth);
  expect(states.at(-1)?.ready).toBe(false);
  expect(states.at(-1)?.identity).toBeNull();
  await sdk.listeners[0](null);
  expect(states.at(-1)?.ready).toBe(true);
  expect(states.at(-1)?.identity).toBeNull();
  await sdk.listeners[0](applicant);
  expect(states.at(-1)?.identity?.verified).toBe(true);
  expect(hasWorkspaceAccess(states.at(-1)!.identity, null)).toBe(false);
  expect(hasWorkspaceAccess(states.at(-1)!.identity, { uid: "applicant", email: "applicant@example.com", name: "Applicant", role: "member", active: true })).toBe(true);
  await sdk.listeners[0](user("applicant", false));
  expect(hasWorkspaceAccess(states.at(-1)!.identity, { uid: "applicant", email: "applicant@example.com", name: "Applicant", role: "member", active: true })).toBe(false);
  stop();
});

test("a slow token from the previous account cannot replace a newer signed-in identity", async () => {
  let finishOldToken!: (result: unknown) => void;
  const previousUser = { ...user("previous"), getIdTokenResult: () => new Promise(resolve => { finishOldToken = resolve; }) } as User;
  const sdk = authentication(async () => null);
  const states: CloudAuthenticationState[] = [];
  const stop = observeCloudAuthentication(sdk.auth, state => states.push(state));
  await completeGoogleRedirect(sdk.auth);
  const oldRead = sdk.listeners[0](previousUser);
  await sdk.listeners[0](user("current"));
  finishOldToken({ claims: { email: "previous@example.com", email_verified: true } });
  await oldRead;
  expect(states.at(-1)?.identity?.uid).toBe("current");
  expect(states.at(-1)?.ready).toBe(true);
  stop();
});

test("redirect network diagnostics contain only fixed classifications and never the source error or credentials", async () => {
  const warning = spyOn(console, "warn").mockImplementation(() => {});
  const secret = "private-token-example";
  const cases = [
    { message: `TypeError: Failed to fetch https://example.com/callback?token=${secret}`, cause: "fetch/network" },
    { message: `TypeError: NetworkError when attempting to fetch resource. ${secret}`, cause: "fetch/network" },
    { message: `TypeError: Load failed ${secret}`, cause: "fetch/network" },
    { message: `SyntaxError: Unexpected token '<', response ${secret} is not valid JSON`, cause: "json-parse" },
    { message: `SecurityError: localStorage access denied ${secret}`, cause: "storage" },
    { message: `SecurityError: The operation is insecure. ${secret}`, cause: "other-sdk-exception" },
    { message: `Unrecognized issue ${secret}`, cause: "other-sdk-exception" },
    { message: undefined, cause: "no-sdk-message" },
  ];
  for (const example of cases) {
    const failure = { code: "auth/network-request-failed", message: secret, customData: { message: example.message, credential: secret, email: "private@example.com" } };
    const sdk = authentication(async () => { throw failure; });
    const caught = await completeGoogleRedirect(sdk.auth).catch(error => error);
    expect(caught).toBe(failure);
    expect(warning.mock.calls.at(-1)).toEqual(["Firebase Google login diagnostic", { phase: "google-redirect-result", code: "auth/network-request-failed", cause: example.cause }]);
  }
  expect(warning).toHaveBeenCalledTimes(cases.length);
  expect(JSON.stringify(warning.mock.calls)).not.toContain(secret);
  expect(JSON.stringify(warning.mock.calls)).not.toContain("private@example.com");
  expect(JSON.stringify(warning.mock.calls)).not.toContain("https://");
});

test("non-network redirect failures keep their existing behavior without diagnostic logging", async () => {
  const warning = spyOn(console, "warn").mockImplementation(() => {});
  const failure = { code: "auth/unauthorized-domain", customData: { message: "TypeError: Failed to fetch" } };
  const sdk = authentication(async () => { throw failure; });
  expect(await completeGoogleRedirect(sdk.auth).catch(error => error)).toBe(failure);
  expect(warning).not.toHaveBeenCalled();
});

test("a broken console implementation cannot change the original authentication error", async () => {
  spyOn(console, "warn").mockImplementation(() => { throw new Error("Console unavailable"); });
  const failure = { code: "auth/network-request-failed" };
  const sdk = authentication(async () => { throw failure; });
  expect(await completeGoogleRedirect(sdk.auth).catch(error => error)).toBe(failure);
});
