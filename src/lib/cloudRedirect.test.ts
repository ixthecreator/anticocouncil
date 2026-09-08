import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import * as firebaseAuth from "firebase/auth";
import * as firebaseApp from "firebase/app";
import * as firebaseConfig from "./firebase";
import type { FirebaseApp } from "firebase/app";
import type { Auth, User, UserCredential } from "firebase/auth";
import { completeGoogleRedirect, getCloudAuth, hasWorkspaceAccess, loginWithEmail, loginWithGoogle, logoutCloud, observeCloudAuthentication, requestPasswordReset, type CloudAuthenticationState } from "./cloudAccess";

const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
});
afterEach(() => {
  mock.restore();
  if (originalSessionStorage) Object.defineProperty(globalThis, "sessionStorage", originalSessionStorage);
  else Reflect.deleteProperty(globalThis, "sessionStorage");
});

let fixtureIndex = 0;
function authentication(readResult: () => Promise<UserCredential | null>, beginGoogle = true) {
  const app = { name: `redirect-test-${++fixtureIndex}`, options: {} } as FirebaseApp;
  const helperApp = { name: `${app.name}-google-login-v2`, options: {} } as FirebaseApp;
  const auth = { app, currentUser: null } as Auth;
  const helperAuth = { app: helperApp, currentUser: null } as Auth;
  spyOn(firebaseConfig, "getFirebaseApp").mockReturnValue(app);
  spyOn(firebaseApp, "getApps").mockReturnValue([app, helperApp]);
  const initialize = spyOn(firebaseAuth, "initializeAuth").mockImplementation(candidate => candidate === app ? auth : helperAuth);
  spyOn(firebaseAuth, "signInWithRedirect").mockResolvedValue(undefined as never);
  const signOut = spyOn(firebaseAuth, "signOut").mockResolvedValue();
  const transfer = spyOn(firebaseAuth, "updateCurrentUser").mockResolvedValue();
  const listeners: Array<(user: User | null) => void | Promise<void>> = [];
  const stops: number[] = [];
  const read = spyOn(firebaseAuth, "getRedirectResult").mockImplementation(readResult);
  spyOn(firebaseAuth, "onIdTokenChanged").mockImplementation((_auth, next) => {
    const index = listeners.length;
    listeners.push(next as (user: User | null) => void | Promise<void>);
    return () => { stops.push(index); };
  });
  if (beginGoogle) void loginWithGoogle();
  return { auth, helperAuth, listeners, stops, read, signOut, transfer, initialize };
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
  expect(states.at(-1)?.ready).toBe(true);
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
  expect(sdk.transfer).toHaveBeenCalledWith(sdk.auth, applicant);
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

test("pending Google helper leaves the email gate ready and email sign-in invalidates a late Google result", async () => {
  let finish!: (result: UserCredential | null) => void;
  const sdk = authentication(() => new Promise(resolve => { finish = resolve; }));
  const login = spyOn(firebaseAuth, "signInWithEmailAndPassword").mockResolvedValue({ user: user("email") } as UserCredential);
  const states: CloudAuthenticationState[] = [];
  const stop = observeCloudAuthentication(sdk.auth, state => states.push(state));
  const pending = completeGoogleRedirect(sdk.auth);
  await sdk.listeners[0](null);
  expect(states.at(-1)?.ready).toBe(true);
  expect(states.at(-1)?.redirectPending).toBe(true);
  await loginWithEmail(" email@example.com ", "site-password");
  expect(login).toHaveBeenCalledWith(sdk.auth, "email@example.com", "site-password");
  expect(states.at(-1)?.redirectPending).toBe(false);
  finish({ user: user("late-google") } as UserCredential);
  await pending;
  expect(sdk.transfer).not.toHaveBeenCalled();
  expect(sdk.read).toHaveBeenCalledWith(sdk.helperAuth, firebaseAuth.browserPopupRedirectResolver);
  stop();
});

test("logout and unsubscribe each prevent a pending Google result from transferring an account", async () => {
  for (const action of ["logout", "unsubscribe"] as const) {
    let finish!: (result: UserCredential | null) => void;
    const sdk = authentication(() => new Promise(resolve => { finish = resolve; }));
    const states: CloudAuthenticationState[] = [];
    const stop = observeCloudAuthentication(sdk.auth, state => states.push(state));
    const pending = completeGoogleRedirect(sdk.auth);
    await sdk.listeners[0](null);
    if (action === "logout") await logoutCloud();
    stop();
    const count = states.length;
    finish({ user: user("late-google") } as UserCredential);
    await pending;
    expect(sdk.transfer).not.toHaveBeenCalled();
    expect(states.length).toBe(count);
  }
});

test("password recovery can run while Google is pending and suppresses an obsolete redirect failure", async () => {
  let reject!: (error: unknown) => void;
  const sdk = authentication(() => new Promise((_resolve, fail) => { reject = fail; }));
  const reset = spyOn(firebaseAuth, "sendPasswordResetEmail").mockResolvedValue();
  const states: CloudAuthenticationState[] = [];
  const stop = observeCloudAuthentication(sdk.auth, state => states.push(state));
  const pending = completeGoogleRedirect(sdk.auth);
  await sdk.listeners[0](null);
  await requestPasswordReset("member@example.com");
  expect(reset).toHaveBeenCalledTimes(1);
  reject({ code: "auth/network-request-failed" });
  await pending;
  expect(states.at(-1)?.ready).toBe(true);
  expect(states.at(-1)?.redirectError).toBe("");
  stop();
});

test("an unrequested helper result is never read and existing primary sessions remain the token source", async () => {
  const sdk = authentication(async () => ({ user: user("unexpected-google") }) as UserCredential, false);
  expect(getCloudAuth()).toBe(sdk.auth);
  const states: CloudAuthenticationState[] = [];
  const stop = observeCloudAuthentication(sdk.auth, state => states.push(state));
  await sdk.listeners[0](user("persisted-member"));
  await completeGoogleRedirect(sdk.auth);
  expect(states.at(-1)?.identity?.uid).toBe("persisted-member");
  expect(states.at(-1)?.ready).toBe(true);
  expect(sdk.read).not.toHaveBeenCalled();
  expect(sdk.transfer).not.toHaveBeenCalled();
  // Exact same Firebase app and persistence choices as the previous getAuth()
  // defaults, with no automatic OAuth resolver to block hydration.
  expect(sdk.initialize.mock.calls[0]).toEqual([sdk.auth.app, {
    persistence: [firebaseAuth.indexedDBLocalPersistence, firebaseAuth.browserLocalPersistence, firebaseAuth.browserSessionPersistence],
  }]);
  expect(sdk.initialize).toHaveBeenCalledTimes(1);
  stop();
});

test("the real Firebase primary Auth initializes while the isolated redirect SDK call remains pending", async () => {
  const app = firebaseApp.initializeApp({ apiKey: "offline-test-key", projectId: "offline-test", appId: "offline-test-app" }, `sdk-init-test-${++fixtureIndex}`);
  spyOn(firebaseConfig, "getFirebaseApp").mockReturnValue(app);
  let finish!: (result: UserCredential | null) => void;
  const read = spyOn(firebaseAuth, "getRedirectResult").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  spyOn(firebaseAuth, "signInWithRedirect").mockResolvedValue(undefined as never);
  const auth = getCloudAuth();
  await loginWithGoogle();
  const states: CloudAuthenticationState[] = [];
  const stop = observeCloudAuthentication(auth, state => states.push(state));
  const pending = completeGoogleRedirect(auth);
  // authStateReady and onIdTokenChanged are the real SDK implementations here,
  // not gate mocks. No network request is needed for an anonymous session.
  await auth.authStateReady();
  await Promise.resolve();
  expect(states.at(-1)?.ready).toBe(true);
  expect(states.at(-1)?.identity).toBeNull();
  expect(states.at(-1)?.redirectPending).toBe(true);
  expect(read).toHaveBeenCalledTimes(1);
  expect(read.mock.calls[0][0]).not.toBe(auth);
  finish(null);
  await pending;
  stop();
  const helper = firebaseApp.getApps().find(candidate => candidate.name === `${app.name}-google-login-v2`);
  await firebaseApp.deleteApp(app);
  if (helper) await firebaseApp.deleteApp(helper);
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
