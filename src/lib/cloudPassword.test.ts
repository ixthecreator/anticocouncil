import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as firebaseAuth from "firebase/auth";
import * as firebaseConfig from "./firebase";
import type { FirebaseApp } from "firebase/app";
import type { Auth, User, UserCredential } from "firebase/auth";
import { cloudAccessError, requestPasswordReset, setSitePassword } from "./cloudAccess";

afterEach(() => mock.restore());
const expectedIdentity = { uid: "existing-uid", email: "current@example.com" };

let fixtureIndex = 0;
function account({ verified = true, passwordProvider = false, age = 0, signedIn = true } = {}) {
  const token = mock(async () => ({ claims: {
    email: "current@example.com", email_verified: verified,
    auth_time: Math.floor(Date.now() / 1000) - age,
  } }));
  const user = {
    uid: "existing-uid", email: "current@example.com", emailVerified: verified,
    providerData: [{ providerId: "google.com" }, ...(passwordProvider ? [{ providerId: "password" }] : [])],
    getIdTokenResult: token,
  } as unknown as User;
  const app = { name: `password-test-${++fixtureIndex}`, options: {} } as FirebaseApp;
  const auth = { app, currentUser: signedIn ? user : null } as Auth;
  spyOn(firebaseConfig, "getFirebaseApp").mockReturnValue(app);
  spyOn(firebaseAuth, "initializeAuth").mockReturnValue(auth);
  const refresh = spyOn(firebaseAuth, "reload").mockResolvedValue();
  const reset = spyOn(firebaseAuth, "sendPasswordResetEmail").mockResolvedValue();
  const link = spyOn(firebaseAuth, "linkWithCredential").mockResolvedValue({ user } as UserCredential);
  const update = spyOn(firebaseAuth, "updatePassword").mockResolvedValue();
  const register = spyOn(firebaseAuth, "createUserWithEmailAndPassword").mockResolvedValue({ user } as UserCredential);
  return { auth, user, token, refresh, reset, link, update, register };
}

test("password recovery sends Chinese mail with only the fixed trusted return address", async () => {
  const sdk = account({ signedIn: false });
  await requestPasswordReset(" person@example.com ");
  expect(sdk.auth.languageCode).toBe("zh-CN");
  expect(sdk.reset).toHaveBeenCalledWith(sdk.auth, "person@example.com", {
    url: "https://www.anticocouncil.com/portal", handleCodeInApp: false,
  });
  expect(sdk.register).not.toHaveBeenCalled();
  expect(sdk.auth.currentUser).toBeNull();
});

test("unknown accounts have the same successful recovery outcome without exposing account existence", async () => {
  const sdk = account({ signedIn: false });
  expect(await requestPasswordReset("person@example.com")).toBeUndefined();
  sdk.reset.mockRejectedValueOnce({ code: "auth/user-not-found" });
  expect(await requestPasswordReset("missing@example.com")).toBeUndefined();
  expect(sdk.reset).toHaveBeenCalledTimes(2);
});

test("malformed recovery email is rejected before sending and operational errors remain visible", async () => {
  const sdk = account({ signedIn: false });
  for (const email of ["", "a@", "a b@example.com", "person@example.com\nother@example.com"]) {
    await expect(requestPasswordReset(email)).rejects.toThrow("有效的邮箱");
  }
  expect(sdk.reset).not.toHaveBeenCalled();
  const failure = { code: "auth/too-many-requests" };
  sdk.reset.mockRejectedValueOnce(failure);
  expect(await requestPasswordReset("person@example.com").catch(error => error)).toBe(failure);
  expect(cloudAccessError(failure)).toContain("频繁");
});

test("a verified Google account links a password to its current UID and locked email without registration", async () => {
  const sdk = account();
  await setSitePassword("new-site-password", "new-site-password", expectedIdentity);
  expect(sdk.refresh).toHaveBeenCalledWith(sdk.user);
  expect(sdk.token).toHaveBeenCalledWith(true);
  expect(sdk.link).toHaveBeenCalledTimes(1);
  const [linkedUser, credential] = sdk.link.mock.calls[0];
  expect(linkedUser).toBe(sdk.user);
  expect(linkedUser.uid).toBe("existing-uid");
  expect(credential.providerId).toBe("password");
  expect(credential.toJSON()).toMatchObject({ email: "current@example.com" });
  expect(sdk.update).not.toHaveBeenCalled();
  expect(sdk.register).not.toHaveBeenCalled();
  expect(sdk.auth.currentUser).toBe(sdk.user);
});

test("an existing password is updated on the current user rather than linked or registered again", async () => {
  const sdk = account({ passwordProvider: true });
  await setSitePassword("new-site-password", "new-site-password", expectedIdentity);
  expect(sdk.update).toHaveBeenCalledWith(sdk.user, "new-site-password");
  expect(sdk.link).not.toHaveBeenCalled();
  expect(sdk.register).not.toHaveBeenCalled();
});

test("password mismatch and invalid lengths never reach account mutation APIs", async () => {
  const sdk = account();
  for (const [password, confirmation] of [
    ["short", "short"], ["        ", "        "],
    ["valid-password", "different-password"], ["x".repeat(129), "x".repeat(129)],
  ]) await expect(setSitePassword(password, confirmation, expectedIdentity)).rejects.toThrow();
  expect(sdk.refresh).not.toHaveBeenCalled();
  expect(sdk.link).not.toHaveBeenCalled();
  expect(sdk.update).not.toHaveBeenCalled();
});

test("signed-out and unverified users cannot set a site password", async () => {
  const signedOut = account({ signedIn: false });
  await expect(setSitePassword("valid-password", "valid-password", expectedIdentity)).rejects.toThrow("先登录");
  expect(signedOut.link).not.toHaveBeenCalled();
  const unverified = account({ verified: false });
  await expect(setSitePassword("valid-password", "valid-password", expectedIdentity)).rejects.toThrow("验证");
  expect(unverified.link).not.toHaveBeenCalled();
  expect(unverified.update).not.toHaveBeenCalled();
});

test("recent authentication is required even for linking and backend security rejection is preserved", async () => {
  const stale = account({ age: 301 });
  const error = await setSitePassword("valid-password", "valid-password", expectedIdentity).catch(value => value);
  expect(error.code).toBe("auth/requires-recent-login");
  expect(stale.link).not.toHaveBeenCalled();
  const recent = account();
  const rejection = { code: "auth/requires-recent-login" };
  recent.link.mockRejectedValueOnce(rejection);
  expect(await setSitePassword("valid-password", "valid-password", expectedIdentity).catch(value => value)).toBe(rejection);
  expect(cloudAccessError(rejection)).toContain("重新登录");
});

test("an account change during verification cannot bind a password to either account", async () => {
  const sdk = account();
  let finish!: () => void;
  sdk.refresh.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const pending = setSitePassword("valid-password", "valid-password", expectedIdentity);
  Object.assign(sdk.auth, { currentUser: { ...sdk.user, uid: "another-uid" } });
  finish();
  await expect(pending).rejects.toThrow("账号已变更");
  expect(sdk.link).not.toHaveBeenCalled();
  expect(sdk.update).not.toHaveBeenCalled();
});

test("a dialog for a previous identity cannot start a password change on the current account", async () => {
  const sdk = account();
  await expect(setSitePassword("valid-password", "valid-password", { uid: "old-uid", email: "old@example.com" })).rejects.toThrow("账号已变更");
  await expect(setSitePassword("valid-password", "valid-password", { uid: sdk.user.uid, email: "old@example.com" })).rejects.toThrow("账号已变更");
  expect(sdk.refresh).not.toHaveBeenCalled();
  expect(sdk.link).not.toHaveBeenCalled();
  expect(sdk.update).not.toHaveBeenCalled();
});

test("link conflicts produce an actionable error without attempting an automatic account merge", async () => {
  const sdk = account();
  const failure = { code: "auth/credential-already-in-use" };
  sdk.link.mockRejectedValueOnce(failure);
  expect(await setSitePassword("valid-password", "valid-password", expectedIdentity).catch(value => value)).toBe(failure);
  expect(cloudAccessError(failure)).toContain("其他账号");
  expect(sdk.update).not.toHaveBeenCalled();
  expect(sdk.register).not.toHaveBeenCalled();
});
