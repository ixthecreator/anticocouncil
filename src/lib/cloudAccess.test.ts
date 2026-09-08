import { describe, expect, test } from "bun:test";
import { OWNER_EMAIL, canChangeMemberRole, canManageMember, hasWorkspaceAccess, isConfirmedAccessSnapshot, isWorkspaceOwner, readWorkspaceAccess, sameAuthorizationIdentity, type AccessActor, type CloudIdentity, type WorkspaceAccess } from "./cloudAccess";
const identity = (changes: Partial<CloudIdentity> = {}): CloudIdentity => ({ uid: "alice", email: "alice@example.com", name: "Alice", verified: true, ...changes });
const access = (changes: Partial<WorkspaceAccess> = {}): WorkspaceAccess => ({ uid: "alice", email: "alice@example.com", name: "Alice", role: "member", active: true, ...changes });
const actor = (changes: Partial<AccessActor> = {}): AccessActor => ({ ...identity(), role: "admin", ...changes });
describe("cloud access boundaries", () => {
  test("ordinary token refresh keeps forms mounted, while identity or verification changes invalidate access", () => {
    expect(sameAuthorizationIdentity(identity(), identity())).toBe(true);
    expect(sameAuthorizationIdentity(identity(), identity({ name: "Updated name" }))).toBe(true);
    expect(sameAuthorizationIdentity(identity(), identity({ uid: "bob" }))).toBe(false);
    expect(sameAuthorizationIdentity(identity(), identity({ email: "new@example.com" }))).toBe(false);
    expect(sameAuthorizationIdentity(identity(), identity({ verified: false }))).toBe(false);
    expect(sameAuthorizationIdentity(null, identity())).toBe(false);
  });
  test("offline cache and unconfirmed local writes cannot establish authorization", () => {
    expect(isConfirmedAccessSnapshot({ fromCache: false, hasPendingWrites: false })).toBe(true);
    expect(isConfirmedAccessSnapshot({ fromCache: true, hasPendingWrites: false })).toBe(false);
    expect(isConfirmedAccessSnapshot({ fromCache: false, hasPendingWrites: true })).toBe(false);
    expect(isConfirmedAccessSnapshot({ fromCache: true, hasPendingWrites: true })).toBe(false);
  });
  test("verified owner can initialize an empty council without a membership document", () => {
    expect(OWNER_EMAIL).toBe("yulun8964@gmail.com");
    expect(hasWorkspaceAccess(identity({ email: OWNER_EMAIL }), null)).toBe(true);
    expect(isWorkspaceOwner(identity({ email: OWNER_EMAIL, verified: false }))).toBe(false);
    expect(hasWorkspaceAccess(identity({ email: OWNER_EMAIL, verified: false }), null)).toBe(false);
  });
  test("the former owner needs an active matching membership and is never a permanent administrator", () => {
    const previousOwner = identity({ uid: "previous-owner", email: "ez4eason@gmail.com" });
    const administrator = access({ uid: previousOwner.uid, email: previousOwner.email, role: "admin" });
    const memberToManage = access({ uid: "other-member" });
    expect(isWorkspaceOwner(previousOwner)).toBe(false);
    expect(hasWorkspaceAccess(previousOwner, null)).toBe(false);
    expect(hasWorkspaceAccess(previousOwner, administrator)).toBe(true);
    expect(hasWorkspaceAccess(previousOwner, { ...administrator, active: false })).toBe(false);
    expect(hasWorkspaceAccess(previousOwner, { ...administrator, uid: "someone-else" })).toBe(false);
    expect(hasWorkspaceAccess(previousOwner, { ...administrator, email: "different@example.com" })).toBe(false);
    expect(hasWorkspaceAccess({ ...previousOwner, verified: false }, administrator)).toBe(false);
    expect(canManageMember({ ...previousOwner, role: administrator.role }, memberToManage)).toBe(true);
    expect(canManageMember({ ...previousOwner, role: "member" }, memberToManage)).toBe(false);
    expect(canManageMember({ ...previousOwner, role: "admin" }, { ...memberToManage, role: "admin" })).toBe(false);
  });
  test("only the new verified owner can change administrator roles, including the former owner's role", () => {
    const newOwner = actor({ uid: "new-owner", email: "yulun8964@gmail.com" });
    const previousAdministrator = access({ uid: "previous-owner", email: "ez4eason@gmail.com", role: "admin" });
    const anotherMember = access({ uid: "other-member" });
    expect(isWorkspaceOwner(newOwner)).toBe(true);
    expect(canChangeMemberRole(newOwner, previousAdministrator)).toBe(true);
    expect(canManageMember(newOwner, previousAdministrator)).toBe(true);
    expect(canChangeMemberRole({ ...newOwner, verified: false }, previousAdministrator)).toBe(false);
    expect(canChangeMemberRole({ ...identity({ uid: previousAdministrator.uid, email: previousAdministrator.email }), role: "admin" }, anotherMember)).toBe(false);
    expect(canChangeMemberRole(actor({ uid: "other-administrator" }), anotherMember)).toBe(false);
    expect(canManageMember(actor({ uid: previousAdministrator.uid, email: previousAdministrator.email }), access({ uid: newOwner.uid, email: newOwner.email, role: "admin" }))).toBe(false);
  });
  test("sign-in, email verification and approval are separate requirements", () => {
    expect(hasWorkspaceAccess(null, access())).toBe(false);
    expect(hasWorkspaceAccess(identity(), null)).toBe(false);
    expect(hasWorkspaceAccess(identity({ verified: false }), access())).toBe(false);
    expect(hasWorkspaceAccess(identity(), access({ active: false }))).toBe(false);
    expect(hasWorkspaceAccess(identity(), access({ uid: "someone-else" }))).toBe(false);
    expect(hasWorkspaceAccess(identity(), access({ email: "old@example.com" }))).toBe(false);
    expect(hasWorkspaceAccess(identity(), access())).toBe(true);
  });
  test("revoking a member or admin removes the client authorization decision", () => {
    for (const role of ["member", "admin"] as const) {
      expect(hasWorkspaceAccess(identity(), access({ role, active: true }))).toBe(true);
      expect(hasWorkspaceAccess(identity(), access({ role, active: false }))).toBe(false);
    }
  });
  test("members cannot administer others or grant themselves access", () => {
    expect(canManageMember(actor({ role: "member" }), access({ uid: "bob" }))).toBe(false);
    expect(canManageMember(actor(), access())).toBe(false);
    expect(canChangeMemberRole(actor(), access())).toBe(false);
  });
  test("admins can manage ordinary members but cannot promote anyone or manage other admins", () => {
    const target = access({ uid: "bob", email: "bob@example.com" });
    expect(canManageMember(actor(), target)).toBe(true);
    expect(canChangeMemberRole(actor(), target)).toBe(false);
    expect(canManageMember(actor(), { ...target, role: "admin" })).toBe(false);
  });
  test("owner protection and self-management denial hold even for an owner actor", () => {
    const ownerActor = actor({ uid: "owner", email: OWNER_EMAIL });
    expect(canManageMember(ownerActor, access({ uid: "owner", email: OWNER_EMAIL, role: "admin" }))).toBe(false);
    expect(canManageMember(actor(), access({ uid: "owner", email: OWNER_EMAIL, role: "member" }))).toBe(false);
    expect(canChangeMemberRole(ownerActor, access({ uid: "bob", email: "bob@example.com" }))).toBe(true);
    expect(canManageMember({ ...ownerActor, verified: false }, access({ uid: "bob" }))).toBe(false);
  });
  test("malformed access documents fail closed", () => {
    expect(readWorkspaceAccess("alice", { ...access(), role: "owner" })).toBeNull();
    expect(readWorkspaceAccess("alice", { ...access(), active: "true" })).toBeNull();
    expect(readWorkspaceAccess("alice", null)).toBeNull();
    expect(readWorkspaceAccess("alice", { ...access() })?.active).toBe(true);
  });
});
