import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { AccessActor, WorkspaceAccess } from "./accessPolicy";
import {
  approveWorkspaceRequest, cloudbaseAuthFailure, identityForUser, loginWithEmail, observeCloudbaseAuthentication,
  registerWithEmail, requestPasswordReset, requestWorkspaceAccess, updateWorkspaceMember, watchOwnWorkspaceAccess,
  watchWorkspaceMembership,
} from "./cloudbaseAccess";
import * as cloudbaseApp from "./cloudbaseApp";

afterEach(() => mock.restore());

type Row = Record<string, any>;
const ok = <T extends object>(data: T) => ({ data, error: null });
const failure = (error: Row) => ({ data: {}, error });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

// An in-memory stand-in for the CloudBase app: auth, realtime watches and the membership function.
function fakeService() {
  const session: { user: Row | null } = { user: null };
  const listeners = new Set<(event: string) => void>();
  const watchers: Row[] = [];
  const state = { functionResult: (_data: Row): unknown => ({ ok: true }) };
  const auth = {
    // Like the SDK, a visitor without a session gets an error rather than an empty user.
    getSession: mock(async (): Promise<Row> => session.user ? ok({ user: session.user }) : failure({ code: "unauthenticated", category: "INVALID_CREDENTIALS" })),
    refreshSession: mock(async () => ok({ user: session.user })),
    onAuthStateChange: mock((callback: (event: string) => void) => {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    }),
    signInWithPassword: mock(async (_params: Row): Promise<Row> => ok({ user: null })),
    signUp: mock(async (_params: Row): Promise<Row> => ok({ verifyOtp: mock(async (_code: Row): Promise<Row> => ok({ user: null })) })),
    resend: mock(async (_params: Row): Promise<Row> => ok({ messageId: "message-2" })),
    resetPasswordForEmail: mock(async (_email: string): Promise<Row> => ok({ updateUser: mock(async (_params: Row): Promise<Row> => ok({ user: null })) })),
    signOut: mock(async () => ({ data: {}, error: null })),
  };
  const query = (name: string, where?: Row) => ({
    watch(options: Row) {
      const watcher = { name, where, ...options, close: mock(() => {}) };
      watchers.push(watcher);
      return { close: watcher.close };
    },
  });
  const app = {
    auth,
    database: () => ({ collection: (name: string) => ({ ...query(name), where: (where: Row) => query(name, where) }) }),
    callFunction: mock(async ({ data }: Row): Promise<Row> => ({ result: state.functionResult(data) })),
  };
  spyOn(cloudbaseApp, "getCloudbaseApp").mockResolvedValue(app as never);
  return { app, auth, session, watchers, state, emit: (event: string) => listeners.forEach(listener => listener(event)), listeners };
}

describe("account messages", () => {
  test("a rejected credential is explained by the step that failed", () => {
    expect(cloudbaseAuthFailure({ category: "INVALID_CREDENTIALS" }, "login").message).toBe("邮箱或密码不正确，请重新输入。");
    expect(cloudbaseAuthFailure({ category: "USER_NOT_FOUND" }, "login").message).toBe("邮箱或密码不正确，请重新输入。");
    expect(cloudbaseAuthFailure({ category: "VERIFICATION_FAILED" }, "code").message).toBe("验证码不正确或已过期，请重新输入或重新发送。");
    expect(cloudbaseAuthFailure({ category: "INVALID_CREDENTIALS" }, "code").message).toBe("验证码不正确或已过期，请重新输入或重新发送。");
    expect(cloudbaseAuthFailure({ category: "INVALID_PARAMS", code: "invalid_password", message: "password is too weak" }, "code").message).toContain("密码未满足");
  });
  test("service settings and limits are named in plain words", () => {
    expect(cloudbaseAuthFailure({ category: "PROVIDER_NOT_ENABLED" }, "send").message).toContain("尚未在云开发控制台启用");
    expect(cloudbaseAuthFailure({ category: "SERVICE_ERROR", message: "smtp is not set" }, "send").message).toContain("尚未开启邮件发送");
    expect(cloudbaseAuthFailure({ category: "RATE_LIMITED" }, "send").message).toBe("操作过于频繁，请稍后重试。");
    expect(cloudbaseAuthFailure({ category: "USER_STATUS_ABNORMAL" }, "login").message).toContain("已被停用");
    const unknown = cloudbaseAuthFailure({ code: "mystery" }, "account");
    expect(unknown.message).toBe("操作未完成，请重试；如果持续失败，请联系管理员。");
    expect((unknown as Error & { code: string }).code).toBe("mystery");
  });
});

describe("identity", () => {
  test("an account with an email is verified, and its name comes from its profile", () => {
    expect(identityForUser(null)).toBeNull();
    expect(identityForUser({ id: "u1", email: " a@example.com ", user_metadata: { name: " 甲 " } })).toEqual({ uid: "u1", email: "a@example.com", name: "甲", verified: true });
    expect(identityForUser({ id: "u1", email: "a@example.com", user_metadata: { name: "", nickName: "乙" } })?.name).toBe("乙");
    expect(identityForUser({ id: "u1", email: null })?.verified).toBe(false);
  });

  test("the session is read at start, reread after each auth event, and unchanged identities are kept", async () => {
    const service = fakeService();
    service.session.user = { id: "u1", email: "a@example.com", user_metadata: { name: "甲" } };
    const states: Row[] = [];
    const stop = observeCloudbaseAuthentication(state => states.push(state));
    expect(states[0]).toMatchObject({ identity: null, ready: false });
    await settle();
    expect(states.at(-1)).toMatchObject({ identity: { uid: "u1", email: "a@example.com", name: "甲", verified: true }, ready: true, error: "" });
    const first = states.at(-1)!.identity;
    service.emit("TOKEN_REFRESHED");
    await settle();
    expect(states.at(-1)!.identity).toBe(first);
    service.session.user = null;
    service.emit("SIGNED_OUT");
    await settle();
    expect(states.at(-1)).toMatchObject({ identity: null, ready: true, error: "" });
    stop();
    expect(service.listeners.size).toBe(0);
  });

  test("a visitor who has not signed in sees the sign-in form, not an error", async () => {
    fakeService();
    const states: Row[] = [];
    observeCloudbaseAuthentication(state => states.push(state));
    await settle();
    expect(states.at(-1)).toEqual({ identity: null, ready: true, error: "", redirectError: "", redirectPending: false });
  });

  test("a session that cannot be read leaves the visitor signed out with a reason", async () => {
    const service = fakeService();
    service.auth.getSession.mockResolvedValue(failure({ category: "SERVICE_ERROR" }) as never);
    const states: Row[] = [];
    observeCloudbaseAuthentication(state => states.push(state));
    await settle();
    expect(states.at(-1)).toMatchObject({ identity: null, ready: true, error: "暂时无法连接云开发登录服务，请检查网络后重试。" });
  });
});

describe("registration and password reset with emailed codes", () => {
  test("form mistakes are caught before anything is sent", async () => {
    const service = fakeService();
    await expect(registerWithEmail(" ", "a@example.com", "long enough")).rejects.toThrow("成员姓名");
    await expect(registerWithEmail("甲", "a@example.com", "short")).rejects.toThrow("8 至 128 位");
    await expect(registerWithEmail("甲", "not-an-email", "long enough")).rejects.toThrow("有效的邮箱地址");
    expect(service.auth.signUp).not.toHaveBeenCalled();
  });

  test("the latest emailed code completes the registration", async () => {
    const service = fakeService();
    const verifyOtp = mock(async (_code: Row): Promise<Row> => ok({ user: { id: "u1" } }));
    service.auth.signUp.mockResolvedValue(ok({ verifyOtp }));
    const challenge = await registerWithEmail(" 甲 ", " a@example.com ", "long enough");
    expect(service.auth.signUp).toHaveBeenCalledWith({ email: "a@example.com", password: "long enough", name: "甲" });
    expect(challenge.email).toBe("a@example.com");
    await expect(challenge.confirm("12ab")).rejects.toThrow("请输入邮件中的数字验证码。");
    expect(verifyOtp).not.toHaveBeenCalled();
    await challenge.confirm(" 123 456 ");
    expect(verifyOtp).toHaveBeenLastCalledWith({ token: "123456" });
    await challenge.resend();
    expect(service.auth.resend).toHaveBeenCalledWith({ type: "signup", email: "a@example.com" });
    await challenge.confirm("654321");
    expect(verifyOtp).toHaveBeenLastCalledWith({ token: "654321", messageId: "message-2" });
    verifyOtp.mockResolvedValue(failure({ category: "VERIFICATION_FAILED" }));
    await expect(challenge.confirm("000000")).rejects.toThrow("验证码不正确或已过期");
  });

  test("a reset sets the new password with the code, and unknown addresses get the same answer", async () => {
    const service = fakeService();
    const updateUser = mock(async (_params: Row): Promise<Row> => ok({ user: { id: "u1" } }));
    service.auth.resetPasswordForEmail.mockResolvedValue(ok({ updateUser }));
    const known = await requestPasswordReset("a@example.com");
    await expect(known.confirm("123456", "long enough", "different")).rejects.toThrow("两次输入的密码不一致");
    await known.confirm("123456", "long enough", "long enough");
    expect(updateUser).toHaveBeenCalledWith({ nonce: "123456", password: "long enough" });

    service.auth.resetPasswordForEmail.mockResolvedValue(failure({ category: "USER_NOT_FOUND" }));
    const unknown = await requestPasswordReset("nobody@example.com");
    expect(unknown.email).toBe("nobody@example.com");
    await expect(unknown.confirm("123456", "long enough", "long enough")).rejects.toThrow("验证码不正确或已过期");

    service.auth.resetPasswordForEmail.mockResolvedValue(failure({ category: "RATE_LIMITED" }));
    await expect(requestPasswordReset("a@example.com")).rejects.toThrow("操作过于频繁");
  });

  test("a wrong password is reported without saying whether the account exists", async () => {
    const service = fakeService();
    service.auth.signInWithPassword.mockResolvedValue(failure({ category: "USER_NOT_FOUND" }));
    await expect(loginWithEmail("a@example.com", "long enough")).rejects.toThrow("邮箱或密码不正确，请重新输入。");
    expect(service.auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.com", password: "long enough" });
  });
});

describe("membership through the cloud function", () => {
  const member: WorkspaceAccess = { uid: "u1", name: "甲", email: "a@example.com", role: "member", active: true };

  test("own access is read after the roster is claimed, from records narrowed to this account", async () => {
    const service = fakeService();
    const listener = { access: mock(), accessError: mock(), request: mock(), requestError: mock() };
    const stop = watchOwnWorkspaceAccess("u1", listener);
    await settle(); await settle();
    expect(service.app.callFunction).toHaveBeenCalledWith({ name: "membership", data: { action: "claim" } });
    const [access, request] = service.watchers;
    expect(access).toMatchObject({ name: "workspaceAccess", where: { uid: "u1" } });
    expect(request).toMatchObject({ name: "accessRequests", where: { uid: "u1" } });
    access.onChange({ docs: [{ _id: "u1", ...member, role: "owner", syncRevision: "r" }] });
    access.onChange({ docs: [] });
    request.onChange({ docs: [{ _id: "u1", uid: "u1", name: "甲", email: "a@example.com" }] });
    expect(listener.access.mock.calls).toEqual([[{ ...member, role: "owner" }, true], [null, true]]);
    expect(listener.request.mock.calls).toEqual([[{ uid: "u1", name: "甲", email: "a@example.com" }]]);
    stop();
    expect(access.close).toHaveBeenCalledTimes(1);
    expect(request.close).toHaveBeenCalledTimes(1);
  });

  test("a failed roster claim is reported instead of showing an empty membership", async () => {
    const service = fakeService();
    service.state.functionResult = () => ({ ok: false, message: "成员服务暂时出错，请稍后重试。" });
    const listener = { access: mock(), accessError: mock(), request: mock(), requestError: mock() };
    watchOwnWorkspaceAccess("u1", listener);
    await settle(); await settle();
    expect(listener.accessError.mock.calls[0][0].message).toBe("成员服务暂时出错，请稍后重试。");
    expect(service.watchers).toHaveLength(0);
  });

  test("administrators see the list from the function, refreshed at once after their own changes", async () => {
    const service = fakeService();
    service.state.functionResult = data => data.action === "list"
      ? { ok: true, members: [member, { uid: "bad" }], requests: [{ uid: "u2", name: "乙", email: "b@example.com" }] }
      : { ok: true };
    const updates = { members: mock(), requests: mock(), error: mock() };
    const stop = watchWorkspaceMembership(updates);
    await settle(); await settle();
    expect(updates.members).toHaveBeenLastCalledWith([member]);
    expect(updates.requests).toHaveBeenLastCalledWith([{ uid: "u2", name: "乙", email: "b@example.com" }]);
    await approveWorkspaceRequest("u2");
    await settle(); await settle();
    expect(service.app.callFunction).toHaveBeenCalledWith({ name: "membership", data: { action: "approve", uid: "u2" } });
    expect(updates.members).toHaveBeenCalledTimes(2);
    stop();
  });

  test("a refused action shows the function's reason; a missing function is named", async () => {
    const service = fakeService();
    service.state.functionResult = () => ({ ok: false, message: "只有管理员可以管理成员。" });
    await expect(requestWorkspaceAccess("甲")).rejects.toThrow("只有管理员可以管理成员。");
    service.app.callFunction.mockResolvedValue({ code: "FUNCTIONS_NOT_EXIST", message: "not found" });
    await expect(requestWorkspaceAccess("甲")).rejects.toThrow("成员服务尚未部署");
    service.app.callFunction.mockResolvedValue({ result: undefined });
    await expect(requestWorkspaceAccess("甲")).rejects.toThrow("成员服务没有返回有效结果");
  });

  test("the site refuses a change the policy forbids before calling the function", async () => {
    const service = fakeService();
    const admin: AccessActor = { uid: "admin", email: "admin@example.com", name: "管", verified: true, role: "admin" };
    await expect(updateWorkspaceMember(admin, { ...member, role: "admin" }, { active: false })).rejects.toThrow("不能修改此成员的授权。");
    await expect(updateWorkspaceMember(admin, member, { role: "admin" })).rejects.toThrow("只有议会所有者可以调整管理员角色。");
    expect(service.app.callFunction).not.toHaveBeenCalled();
    await updateWorkspaceMember(admin, member, { active: false });
    expect(service.app.callFunction).toHaveBeenCalledWith({ name: "membership", data: { action: "update", uid: "u1", active: false } });
  });
});
