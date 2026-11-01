import { cloudService } from "./cloudService";

// Membership rules shared by every cloud backend.
// Firebase recognises the owner by this verified email. CloudBase security rules cannot
// read an account's email, so there the owner is a membership record with the "owner" role.
export const OWNER_EMAIL = cloudService === "firebase" ? "yulun8964@gmail.com" : "";
export type AccessRole = "member" | "admin" | "owner";
export interface CloudIdentity { uid: string; email: string; name: string; verified: boolean; }
export interface WorkspaceAccess { uid: string; name: string; email: string; role: AccessRole; active: boolean; }
export interface AccessRequest { uid: string; name: string; email: string; }
export interface AccessActor extends CloudIdentity { role: AccessRole; }
// Firestore records never carry the owner role; only CloudBase records may.
export const GRANTED_ROLES: readonly AccessRole[] = ["member", "admin"];
export const CLOUDBASE_ROLES: readonly AccessRole[] = ["member", "admin", "owner"];

export const isWorkspaceOwner = (identity: CloudIdentity | null) =>
  !!OWNER_EMAIL && !!identity?.verified && identity.email === OWNER_EMAIL;
export const ownsWorkspace = (actor: AccessActor) => isWorkspaceOwner(actor) || actor.verified && actor.role === "owner";
// Owners are set where the service is administered, never from the site.
export const isOwnerRecord = (target: WorkspaceAccess) => target.role === "owner" || !!OWNER_EMAIL && target.email === OWNER_EMAIL;
export const sameAuthorizationIdentity = (previous: CloudIdentity | null, next: CloudIdentity) =>
  !!previous && previous.uid === next.uid && previous.email === next.email && previous.verified === next.verified;

export function hasWorkspaceAccess(identity: CloudIdentity | null, access: WorkspaceAccess | null): boolean {
  if (!identity?.verified || !identity.uid || !identity.email) return false;
  return isWorkspaceOwner(identity) || !!access && access.uid === identity.uid && access.email === identity.email && access.active === true && CLOUDBASE_ROLES.includes(access.role);
}
export function canManageMember(actor: AccessActor, target: WorkspaceAccess): boolean {
  if (!actor.verified || actor.uid === target.uid || isOwnerRecord(target)) return false;
  return ownsWorkspace(actor) || actor.role === "admin" && target.role === "member";
}
export function canChangeMemberRole(actor: AccessActor, target: WorkspaceAccess): boolean {
  return ownsWorkspace(actor) && canManageMember(actor, target);
}
export function readWorkspaceAccess(uid: string, value: unknown, roles: readonly AccessRole[] = GRANTED_ROLES): WorkspaceAccess | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.name !== "string" || typeof row.email !== "string" || !roles.includes(row.role as AccessRole) || typeof row.active !== "boolean") return null;
  return { uid, name: row.name, email: row.email, role: row.role as AccessRole, active: row.active };
}
export function readAccessRequest(uid: string, value: unknown): AccessRequest | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return typeof row.name === "string" && typeof row.email === "string" ? { uid, name: row.name, email: row.email } : null;
}

export function validEmail(email: string): string {
  const value = email.trim();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("请填写有效的邮箱地址。");
  return value;
}
export function validateSitePassword(password: string, confirmation = password) {
  if (password.length < 8 || password.length > 128 || !password.trim()) throw new Error("请设置 8 至 128 位密码。");
  if (password !== confirmation) throw new Error("两次输入的密码不一致，请重新输入。");
}
export function validMemberName(name: string): string {
  const value = name.trim();
  if (!value || value.length > 80) throw new Error("请填写 1 至 80 字的成员姓名。");
  return value;
}

// One line per person, ready to import into the CloudBase member roster. Members who
// sign up there with the same email get their role back without a new application.
export function membershipRoster(members: WorkspaceAccess[]): string {
  const rows: { name: string; email: string; role: AccessRole; active: boolean }[] = members
    .map(({ name, email, role, active }) => ({ name, email, role: isOwnerRecord({ uid: "", name, email, role, active }) ? "owner" : role, active }));
  // Firebase keeps its owner outside the membership records. An empty name lets the
  // owner keep the name they sign up with.
  if (OWNER_EMAIL && !members.some(member => member.email === OWNER_EMAIL))
    rows.unshift({ name: "", email: OWNER_EMAIL, role: "owner", active: true });
  return rows.map(row => JSON.stringify(row)).join("\n") + "\n";
}
