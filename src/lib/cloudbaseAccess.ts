import {
  CLOUDBASE_ROLES, canChangeMemberRole, canManageMember, readAccessRequest, readWorkspaceAccess, sameAuthorizationIdentity,
  validEmail, validMemberName, validateSitePassword,
  type AccessActor, type AccessRole, type CloudIdentity, type WorkspaceAccess,
} from "./accessPolicy";
import {
  getCloudbaseApp, type CloudbaseApp, type CloudbaseAuthError, type CloudbaseAuthResult, type CloudbaseRecord, type CloudbaseUser,
} from "./cloudbaseApp";
import { cloudbaseErrorMessage, subscribeToCollection } from "./cloudbaseData";
import type {
  CloudAuthenticationState, EmailCodeChallenge, MembershipListener, OwnAccessListener, PasswordResetChallenge,
} from "./cloudBackend";

// The cloud function that keeps membership records. Members cannot write them directly.
export const MEMBERSHIP_FUNCTION = "membership";
const MEMBERSHIP_POLL_MS = 15000;

type AuthStep = "login" | "send" | "code" | "account";
// CloudBase reports failures in English and names console settings. Members see these
// messages instead; the step decides what a rejected credential most likely was.
export function cloudbaseAuthFailure(error: CloudbaseAuthError | null | undefined, step: AuthStep): Error {
  const category = error?.category || "";
  const code = String(error?.code || "");
  const details = `${code} ${error?.message || ""}`.toLowerCase();
  const message =
    category === "PROVIDER_NOT_ENABLED" ? "此登录方式尚未在云开发控制台启用，请联系管理员。"
    : details.includes("smtp") ? "云开发尚未开启邮件发送，暂时无法发送验证码，请联系管理员。"
    : category === "RATE_LIMITED" ? "操作过于频繁，请稍后重试。"
    : category === "CAPTCHA_REQUIRED" || category === "CAPTCHA_INVALID" ? "需要先完成人机验证，请稍后重试；如果持续出现，请联系管理员。"
    : category === "USER_STATUS_ABNORMAL" ? "此登录账号已被停用，请联系管理员。"
    : category === "VERIFICATION_FAILED" ? "验证码不正确或已过期，请重新输入或重新发送。"
    : step === "login" && ["INVALID_CREDENTIALS", "USER_NOT_FOUND", "AUTH_METHOD_MISMATCH"].includes(category) ? "邮箱或密码不正确，请重新输入。"
    // A new password is checked only after the code, when the account is created or reset.
    : step === "code" && details.includes("password") ? "密码未满足账号服务的安全要求，请换用更长且不易猜测的密码。"
    : step === "code" && ["INVALID_CREDENTIALS", "INVALID_PARAMS"].includes(category) ? "验证码不正确或已过期，请重新输入或重新发送。"
    : category === "SERVICE_ERROR" ? "暂时无法连接云开发登录服务，请检查网络后重试。"
    : category === "INVALID_PARAMS" ? "填写的信息格式不正确，请检查后重试。"
    : "操作未完成，请重试；如果持续失败，请联系管理员。";
  return Object.assign(new Error(message), { code: code || category || "unknown" });
}
function unwrap<T extends object>(result: CloudbaseAuthResult<T>, step: AuthStep): T {
  if (result.error) throw cloudbaseAuthFailure(result.error, step);
  return result.data as T;
}
function readCode(code: string): string {
  const value = code.replace(/\s/g, "");
  if (!/^\d{4,8}$/.test(value)) throw new Error("请输入邮件中的数字验证码。");
  return value;
}

export function identityForUser(user: CloudbaseUser | null | undefined): CloudIdentity | null {
  if (!user?.id) return null;
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const metadata = user.user_metadata || {};
  const name = [metadata.name, metadata.nickName].find((value): value is string => typeof value === "string" && !!value.trim());
  // Accounts here are created by confirming a code sent to their email, so an address proves itself.
  return { uid: String(user.id), email, name: name?.trim() || "", verified: !!email };
}

export function observeCloudbaseAuthentication(onChange: (state: CloudAuthenticationState) => void): () => void {
  let active = true;
  let revision = 0;
  let stop = () => {};
  let state: CloudAuthenticationState = { identity: null, ready: false, error: "", redirectError: "", redirectPending: false };
  const publish = (changes: Partial<CloudAuthenticationState>) => {
    if (!active) return;
    state = { ...state, ...changes };
    onChange(state);
  };
  const failed = (error: unknown) => publish({ identity: null, ready: true, error: error instanceof Error ? error.message : cloudbaseErrorMessage(error) });
  // Each sign-in, sign-out or token refresh rereads the session; only the latest read is published.
  const read = async (app: CloudbaseApp) => {
    const current = ++revision;
    try {
      const result = await app.auth.getSession();
      // A visitor who never signed in, or whose session has ended, is answered with "unauthenticated".
      const next = result.error?.code === "unauthenticated" ? null : identityForUser(unwrap(result, "account").user);
      if (!active || current !== revision) return;
      const previous = state.identity;
      publish({ identity: previous && next && sameAuthorizationIdentity(previous, next) && previous.name === next.name ? previous : next, ready: true, error: "" });
    } catch (error) {
      if (active && current === revision) failed(error);
    }
  };
  publish({});
  getCloudbaseApp().then(app => {
    if (!active) return;
    const { data } = app.auth.onAuthStateChange(() => { void read(app); });
    stop = () => data.subscription.unsubscribe();
    // The session restored at start-up may be announced before this listener exists.
    return read(app);
  }).catch(error => { if (active) failed(error); });
  return () => { active = false; revision++; stop(); };
}

export async function loginWithEmail(email: string, password: string) {
  const address = validEmail(email);
  if (!password) throw new Error("请输入密码。");
  const app = await getCloudbaseApp();
  unwrap(await app.auth.signInWithPassword({ email: address, password }), "login");
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<EmailCodeChallenge> {
  const cleanName = validMemberName(name);
  validateSitePassword(password);
  const address = validEmail(email);
  const app = await getCloudbaseApp();
  // The account is created only once the emailed code is confirmed. For an address that
  // already has an account, the code signs in to it and leaves its password unchanged.
  const { verifyOtp } = unwrap(await app.auth.signUp({ email: address, password, name: cleanName }), "send");
  if (!verifyOtp) throw cloudbaseAuthFailure(null, "send");
  let messageId: string | undefined;
  return {
    email: address,
    async resend() {
      // Only the latest code is accepted.
      messageId = unwrap(await app.auth.resend({ type: "signup", email: address }), "send").messageId || undefined;
    },
    async confirm(code) {
      const token = readCode(code);
      unwrap(await verifyOtp(messageId ? { token, messageId } : { token }), "code");
    },
  };
}

type ResetCallback = NonNullable<Awaited<ReturnType<CloudbaseApp["auth"]["resetPasswordForEmail"]>>["data"]["updateUser"]>;
async function sendResetCode(app: CloudbaseApp, address: string): Promise<ResetCallback | null> {
  const result = await app.auth.resetPasswordForEmail(address);
  if (!result.error) return result.data.updateUser || null;
  // Answer an unknown address like a known one, so the form never reveals who has an account.
  if (result.error.category === "USER_NOT_FOUND") return null;
  throw cloudbaseAuthFailure(result.error, "send");
}
export async function requestPasswordReset(email: string): Promise<PasswordResetChallenge> {
  const address = validEmail(email);
  const app = await getCloudbaseApp();
  let updateUser = await sendResetCode(app, address);
  return {
    email: address,
    async resend() { updateUser = await sendResetCode(app, address); },
    async confirm(code, password, confirmation) {
      const nonce = readCode(code);
      validateSitePassword(password, confirmation);
      if (!updateUser) throw cloudbaseAuthFailure({ category: "VERIFICATION_FAILED" }, "code");
      // A successful reset also signs the account in.
      unwrap(await updateUser({ nonce, password }), "code");
    },
  };
}

export async function resendVerification() {
  throw new Error("当前账号没有邮箱，请退出后使用邮箱注册。");
}
export async function refreshCloudbaseAuthentication() {
  const app = await getCloudbaseApp();
  unwrap(await app.auth.refreshSession(), "account");
}
export async function logoutCloudbase() {
  const app = await getCloudbaseApp();
  const result = await app.auth.signOut() as { error?: CloudbaseAuthError | null } | undefined;
  if (result?.error) throw cloudbaseAuthFailure(result.error, "account");
}

async function callMembership<T extends object = object>(data: CloudbaseRecord): Promise<T> {
  const app = await getCloudbaseApp();
  let response: Awaited<ReturnType<CloudbaseApp["callFunction"]>>;
  try {
    response = await app.callFunction({ name: MEMBERSHIP_FUNCTION, data });
  } catch (error) {
    throw new Error(cloudbaseErrorMessage(error));
  }
  if (response.code) throw new Error(cloudbaseErrorMessage(response));
  const result = response.result as ({ ok?: unknown; message?: unknown } & T) | undefined;
  if (result?.ok !== true) throw new Error(typeof result?.message === "string" && result.message ? result.message : "成员服务没有返回有效结果，请稍后重试。");
  return result;
}
const listOf = <T>(rows: unknown, read: (row: Record<string, unknown>) => T | null) =>
  (Array.isArray(rows) ? rows : [])
    .map(row => row && typeof row === "object" ? read(row as Record<string, unknown>) : null)
    .filter((row): row is T => !!row);

export function watchOwnWorkspaceAccess(uid: string, listener: OwnAccessListener): () => void {
  let active = true;
  const closers: (() => void)[] = [];
  // A roster entry for this account's email becomes its membership on first sign-in.
  callMembership({ action: "claim" }).then(() => {
    if (!active) return;
    // Security rules let an account read only the records that carry its own uid.
    closers.push(subscribeToCollection("workspaceAccess", rows => {
      if (active) listener.access(readWorkspaceAccess(uid, rows.find(row => row.uid === uid), CLOUDBASE_ROLES), true);
    }, error => { if (active) listener.accessError(error); }, { uid }));
    closers.push(subscribeToCollection("accessRequests", rows => {
      if (active) listener.request(readAccessRequest(uid, rows.find(row => row.uid === uid)));
    }, error => { if (active) listener.requestError(error); }, { uid }));
  }, error => { if (active) listener.accessError(error); });
  return () => { active = false; closers.forEach(close => close()); };
}

// Administrators see the member list through the cloud function, which answers only them.
// Changes made here refresh every open list at once; changes made elsewhere arrive with the next poll.
const membershipPolls = new Set<() => void>();
export function watchWorkspaceMembership(listener: MembershipListener): () => void {
  let active = true;
  let running = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (!active) return;
    if (running) { again = true; return; }
    running = true;
    clearTimeout(timer);
    try {
      const { members, requests } = await callMembership<{ members?: unknown; requests?: unknown }>({ action: "list" });
      if (!active) return;
      listener.members(listOf(members, row => readWorkspaceAccess(String(row.uid || ""), row, CLOUDBASE_ROLES)));
      listener.requests(listOf(requests, row => readAccessRequest(String(row.uid || ""), row)));
      timer = setTimeout(() => void poll(), MEMBERSHIP_POLL_MS);
    } catch (error) {
      // A failed list stays failed until the panel is opened again.
      again = false;
      if (active) listener.error(error);
    } finally {
      running = false;
      if (again && active) { again = false; void poll(); }
    }
  };
  membershipPolls.add(poll);
  void poll();
  return () => { active = false; clearTimeout(timer); membershipPolls.delete(poll); };
}
const refreshMembership = () => membershipPolls.forEach(poll => void poll());

export async function requestWorkspaceAccess(name: string) {
  await callMembership({ action: "request", name: validMemberName(name) });
}
export async function approveWorkspaceRequest(uid: string) {
  await callMembership({ action: "approve", uid });
  refreshMembership();
}
export async function declineWorkspaceRequest(uid: string) {
  await callMembership({ action: "decline", uid });
  refreshMembership();
}
export async function updateWorkspaceMember(actor: AccessActor, target: WorkspaceAccess, changes: { active?: boolean; role?: AccessRole }) {
  if (!canManageMember(actor, target)) throw new Error("不能修改此成员的授权。");
  if (changes.role !== undefined && !canChangeMemberRole(actor, target)) throw new Error("只有议会所有者可以调整管理员角色。");
  await callMembership({ action: "update", uid: target.uid, ...changes });
  refreshMembership();
}

export function cloudbaseAccessError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : cloudbaseErrorMessage(error);
}
