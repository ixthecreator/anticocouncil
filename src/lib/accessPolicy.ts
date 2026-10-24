// Membership rules shared by every cloud backend.
export const OWNER_EMAIL = "yulun8964@gmail.com";
export type AccessRole = "member" | "admin";
export interface CloudIdentity { uid: string; email: string; name: string; verified: boolean; }
export interface WorkspaceAccess { uid: string; name: string; email: string; role: AccessRole; active: boolean; }
export interface AccessRequest { uid: string; name: string; email: string; }
export interface AccessActor extends CloudIdentity { role: AccessRole; }

export const isWorkspaceOwner = (identity: CloudIdentity | null) =>
  !!identity?.verified && identity.email === OWNER_EMAIL;
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
