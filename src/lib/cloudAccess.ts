import {
  createUserWithEmailAndPassword, getAuth, getRedirectResult, GoogleAuthProvider, onIdTokenChanged, reload,
  sendEmailVerification, signInWithEmailAndPassword, signInWithRedirect,
  signOut, updateProfile, type Auth, type User,
} from "firebase/auth";
import { deleteDoc, doc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDatabase, getFirebaseApp } from "./firebase";

export const OWNER_EMAIL = "yulun8964@gmail.com";
export type AccessRole = "member" | "admin";
export interface CloudIdentity { uid: string; email: string; name: string; verified: boolean; }
export interface WorkspaceAccess { uid: string; name: string; email: string; role: AccessRole; active: boolean; }
export interface AccessRequest { uid: string; name: string; email: string; }
export interface AccessActor extends CloudIdentity { role: AccessRole; }

export const isWorkspaceOwner = (identity: CloudIdentity | null) =>
  !!identity?.verified && identity.email === OWNER_EMAIL;
export const isConfirmedAccessSnapshot = (metadata: { fromCache: boolean; hasPendingWrites: boolean }) =>
  !metadata.fromCache && !metadata.hasPendingWrites;
export const sameAuthorizationIdentity = (previous: CloudIdentity | null, next: CloudIdentity) =>
  !!previous && previous.uid === next.uid && previous.email === next.email && previous.verified === next.verified;

export function hasWorkspaceAccess(identity: CloudIdentity | null, access: WorkspaceAccess | null): boolean {
  if (!identity?.verified || !identity.uid || !identity.email) return false;
  return isWorkspaceOwner(identity) || !!access && access.uid === identity.uid && access.email === identity.email && access.active === true && ["member", "admin"].includes(access.role);
}
export function canManageMember(actor: AccessActor, target: WorkspaceAccess): boolean {
  if (!actor.verified || actor.uid === target.uid || target.email === OWNER_EMAIL) return false;
  return isWorkspaceOwner(actor) || actor.role === "admin" && target.role === "member";
}
export function canChangeMemberRole(actor: AccessActor, target: WorkspaceAccess): boolean {
  return isWorkspaceOwner(actor) && canManageMember(actor, target);
}
export function readWorkspaceAccess(uid: string, value: unknown): WorkspaceAccess | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.name !== "string" || typeof row.email !== "string" || !["member", "admin"].includes(String(row.role)) || typeof row.active !== "boolean") return null;
  return { uid, name: row.name, email: row.email, role: row.role as AccessRole, active: row.active };
}
export function readAccessRequest(uid: string, value: unknown): AccessRequest | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return typeof row.name === "string" && typeof row.email === "string" ? { uid, name: row.name, email: row.email } : null;
}
export const getCloudAuth = () => getAuth(getFirebaseApp());
export async function identityForUser(user: User): Promise<CloudIdentity> {
  const token = await user.getIdTokenResult();
  return { uid: user.uid, email: typeof token.claims.email === "string" ? token.claims.email : "", name: user.displayName || "", verified: token.claims.email_verified === true };
}

export interface CloudAuthenticationState {
  identity: CloudIdentity | null;
  ready: boolean;
  error: string;
  redirectError: string;
}
const redirectCompletions = new WeakMap<Auth, Promise<void>>();
function reportRedirectNetworkFailure(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "auth/network-request-failed") return;
  const details = "customData" in error ? error.customData : null;
  const message = details && typeof details === "object" && "message" in details && typeof details.message === "string" ? details.message.trim() : "";
  // Only fixed categories leave this function. Firebase errors can contain URLs,
  // tokens and account details, so never log the error or its original message.
  const cause = !message ? "no-sdk-message"
    : /^SyntaxError:/i.test(message) ? "json-parse"
    : /^(?:NetworkError:|TypeError: (?:Failed to fetch|NetworkError|Load failed|fetch failed)|Error: Network Error)/i.test(message) ? "fetch/network"
    : /^(?:QuotaExceededError|SecurityError|InvalidStateError):.*(?:storage|indexeddb)/i.test(message) ? "storage"
    : "other-sdk-exception";
  console.warn("Firebase Google login diagnostic", { phase: "google-redirect-result", code: "auth/network-request-failed", cause });
}
export function completeGoogleRedirect(auth: Auth): Promise<void> {
  let completion = redirectCompletions.get(auth);
  if (!completion) {
    // Firebase consumes a redirect result once. Share completion across effect
    // remounts; do not keep OAuth credentials or use them as member authorization.
    completion = Promise.resolve().then(() => getRedirectResult(auth)).then(() => {}, error => {
      try { reportRedirectNetworkFailure(error); } catch { /* Diagnostics must not replace the original failure. */ }
      throw error;
    });
    redirectCompletions.set(auth, completion);
  }
  return completion;
}

export function observeCloudAuthentication(auth: Auth, onChange: (state: CloudAuthenticationState) => void): () => void {
  let active = true;
  let revision = 0;
  let tokenReady = false;
  let redirectReady = false;
  let state: CloudAuthenticationState = { identity: null, ready: false, error: "", redirectError: "" };
  const publish = (changes: Partial<CloudAuthenticationState>) => {
    if (!active) return;
    state = { ...state, ...changes, ready: tokenReady && redirectReady };
    onChange(state);
  };
  publish({});
  let unsubscribe = () => {};
  try {
    unsubscribe = onIdTokenChanged(auth, async user => {
      if (!active) return;
      const current = ++revision;
      if (!user) {
        tokenReady = true;
        publish({ identity: null, error: "" });
        return;
      }
      if (state.identity?.uid !== user.uid) {
        tokenReady = false;
        publish({ identity: null });
      }
      try {
        const next = await identityForUser(user);
        if (!active || current !== revision) return;
        tokenReady = true;
        const previous = state.identity;
        publish({ identity: previous && sameAuthorizationIdentity(previous, next) && previous.name === next.name ? previous : next, error: "" });
      } catch (error) {
        if (active && current === revision) {
          tokenReady = true;
          publish({ identity: null, error: cloudAccessError(error) });
        }
      }
    }, error => {
      revision++;
      tokenReady = true;
      publish({ identity: null, error: cloudAccessError(error) });
    });
  } catch (error) {
    tokenReady = true;
    publish({ identity: null, error: cloudAccessError(error) });
  }
  void completeGoogleRedirect(auth).then(() => {
    redirectReady = true;
    publish({});
  }, error => {
    redirectReady = true;
    publish({ redirectError: `Google 登录未完成：${cloudAccessError(error)}` });
  });
  return () => { active = false; revision++; unsubscribe(); };
}
async function verifiedIdentity() {
  const user = getCloudAuth().currentUser;
  if (!user) throw new Error("请先登录。");
  const identity = await identityForUser(user);
  if (!identity.verified || !identity.email) throw new Error("请先验证邮箱，再刷新认证状态。");
  return identity;
}
export const loginWithEmail = (email: string, password: string) => signInWithEmailAndPassword(getCloudAuth(), email.trim(), password);
export async function registerWithEmail(name: string, email: string, password: string) {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 80) throw new Error("请填写 1 至 80 字的成员姓名。");
  if (password.length < 8) throw new Error("请设置至少 8 位密码。");
  const credential = await createUserWithEmailAndPassword(getCloudAuth(), email.trim(), password);
  await updateProfile(credential.user, { displayName: cleanName });
  await sendEmailVerification(credential.user);
}
export function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithRedirect(getCloudAuth(), provider);
}
export async function resendVerification() {
  const user = getCloudAuth().currentUser;
  if (!user) throw new Error("请先登录。");
  if (!user.emailVerified) await sendEmailVerification(user);
}
export async function refreshCloudAuthentication() {
  const user = getCloudAuth().currentUser;
  if (!user) throw new Error("登录状态已失效，请重新登录。");
  await reload(user);
  await user.getIdToken(true);
}
export const logoutCloud = () => signOut(getCloudAuth());
export async function requestWorkspaceAccess(name: string) {
  const identity = await verifiedIdentity();
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 80) throw new Error("请填写 1 至 80 字的成员姓名。");
  if (isWorkspaceOwner(identity)) throw new Error("所有者无需申请访问。");
  await setDoc(doc(getDatabase(), "accessRequests", identity.uid), { name: cleanName, email: identity.email, requestedAt: serverTimestamp() });
}
export async function approveWorkspaceRequest(uid: string) {
  const identity = await verifiedIdentity();
  if (uid === identity.uid) throw new Error("不能审批自己的申请。");
  const database = getDatabase();
  await runTransaction(database, async transaction => {
    const requestRef = doc(database, "accessRequests", uid);
    const accessRef = doc(database, "workspaceAccess", uid);
    const [requestSnapshot, accessSnapshot] = await Promise.all([transaction.get(requestRef), transaction.get(accessRef)]);
    const request = readAccessRequest(uid, requestSnapshot.data());
    if (!requestSnapshot.exists() || !request) throw new Error("申请已处理或内容无效，请刷新成员列表。");
    if (accessSnapshot.exists()) throw new Error("此成员已有授权记录，请在成员列表中管理。");
    if (request.email === OWNER_EMAIL) throw new Error("所有者无需审批。");
    transaction.set(accessRef, { name: request.name, email: request.email, role: "member", active: true });
    transaction.delete(requestRef);
  });
}
export async function declineWorkspaceRequest(uid: string) {
  const identity = await verifiedIdentity();
  if (uid === identity.uid) throw new Error("不能审批自己的申请。");
  await deleteDoc(doc(getDatabase(), "accessRequests", uid));
}
export async function updateWorkspaceMember(actor: AccessActor, target: WorkspaceAccess, changes: { active?: boolean; role?: AccessRole }) {
  if (!canManageMember(actor, target)) throw new Error("不能修改此成员的授权。");
  if (changes.role !== undefined && !canChangeMemberRole(actor, target)) throw new Error("只有议会所有者可以调整管理员角色。");
  await updateDoc(doc(getDatabase(), "workspaceAccess", target.uid), changes);
}
export function cloudAccessError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-email": "邮箱格式不正确，请检查后重试。",
    "auth/invalid-credential": "邮箱或密码不正确，请重新输入。",
    "auth/wrong-password": "邮箱或密码不正确，请重新输入。",
    "auth/user-not-found": "邮箱或密码不正确，请重新输入。",
    "auth/email-already-in-use": "此邮箱已经注册，请切换到登录。",
    "auth/weak-password": "密码强度不足，请设置更长且不易猜测的密码。",
    "auth/operation-not-allowed": "此登录方式尚未启用，请联系管理员完成 Firebase 登录配置。",
    "auth/configuration-not-found": "账号登录服务尚未配置，请联系管理员。",
    "auth/unauthorized-domain": "当前网站尚未加入登录服务的授权域名，请联系管理员。",
    "auth/popup-blocked": "浏览器阻止了 Google 登录窗口，请允许弹出窗口后重试。",
    "auth/popup-closed-by-user": "Google 登录窗口已关闭，可以重新打开。",
    "auth/cancelled-popup-request": "已有登录窗口正在处理，请完成该窗口的操作。",
    "auth/account-exists-with-different-credential": "此邮箱已使用其他方式注册，请使用原登录方式。",
    "auth/network-request-failed": "无法连接登录服务，请检查网络后重试。",
    "auth/too-many-requests": "操作过于频繁，请稍后重试。",
    "auth/user-disabled": "此登录账号已被停用，请联系管理员。",
    "auth/requires-recent-login": "请退出并重新登录后再操作。",
    "permission-denied": "没有执行此操作的权限。成员资格可能已变更，请刷新认证状态或联系管理员。",
    "firestore/permission-denied": "没有执行此操作的权限，请联系管理员。",
    "unavailable": "暂时无法连接成员服务，请检查网络后重试。",
  };
  return messages[code] || (error instanceof Error && !code ? error.message : "操作未完成，请重试；如果持续失败，请联系管理员。");
}
