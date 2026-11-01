import { describe, expect, test } from "bun:test";
import {
  CLOUDBASE_ROLES, OWNER_EMAIL, canChangeMemberRole, canManageMember, hasWorkspaceAccess, isOwnerRecord, membershipRoster,
  ownsWorkspace, readWorkspaceAccess, validEmail, validMemberName, validateSitePassword,
  type AccessActor, type CloudIdentity, type WorkspaceAccess,
} from "./accessPolicy";

const identity = (changes: Partial<CloudIdentity> = {}): CloudIdentity => ({ uid: "alice", email: "alice@example.com", name: "Alice", verified: true, ...changes });
const access = (changes: Partial<WorkspaceAccess> = {}): WorkspaceAccess => ({ uid: "alice", email: "alice@example.com", name: "Alice", role: "member", active: true, ...changes });
const actor = (changes: Partial<AccessActor> = {}): AccessActor => ({ ...identity(), role: "admin", ...changes });

describe("owners recorded as a membership role (CloudBase)", () => {
  test("an owner record grants access only to its own verified, matching account while active", () => {
    const owner = access({ role: "owner" });
    expect(hasWorkspaceAccess(identity(), owner)).toBe(true);
    expect(hasWorkspaceAccess(identity(), { ...owner, active: false })).toBe(false);
    expect(hasWorkspaceAccess(identity({ verified: false }), owner)).toBe(false);
    expect(hasWorkspaceAccess(identity({ uid: "mallory" }), owner)).toBe(false);
  });
  test("an owner record carries owner powers, but an unverified one does not", () => {
    const owner = actor({ role: "owner" });
    const member = access({ uid: "bob", email: "bob@example.com" });
    const admin = access({ uid: "carol", email: "carol@example.com", role: "admin" });
    expect(ownsWorkspace(owner)).toBe(true);
    expect(ownsWorkspace({ ...owner, verified: false })).toBe(false);
    expect(canChangeMemberRole(owner, member)).toBe(true);
    expect(canManageMember(owner, admin)).toBe(true);
    expect(canChangeMemberRole({ ...owner, verified: false }, member)).toBe(false);
  });
  test("no one manages an owner record from the site, not even another owner", () => {
    const otherOwner = access({ uid: "olga", email: "olga@example.com", role: "owner" });
    expect(isOwnerRecord(otherOwner)).toBe(true);
    expect(canManageMember(actor({ role: "owner" }), otherOwner)).toBe(false);
    expect(canManageMember(actor(), otherOwner)).toBe(false);
    expect(canChangeMemberRole(actor({ role: "owner" }), otherOwner)).toBe(false);
  });
  test("Firestore records never carry the owner role; CloudBase records may", () => {
    expect(readWorkspaceAccess("alice", { ...access(), role: "owner" })).toBeNull();
    expect(readWorkspaceAccess("alice", { ...access(), role: "owner" }, CLOUDBASE_ROLES)?.role).toBe("owner");
    expect(readWorkspaceAccess("alice", { ...access(), role: "chair" }, CLOUDBASE_ROLES)).toBeNull();
  });
});

describe("member roster export", () => {
  test("every member keeps name, email, role and status, one JSON object per line", () => {
    const lines = membershipRoster([
      access({ uid: "bob", name: "Bob", email: "bob@example.com" }),
      access({ uid: "carol", name: "Carol", email: "carol@example.com", role: "admin", active: false }),
    ]).trim().split("\n").map(line => JSON.parse(line));
    expect(lines).toContainEqual({ name: "Bob", email: "bob@example.com", role: "member", active: true });
    expect(lines).toContainEqual({ name: "Carol", email: "carol@example.com", role: "admin", active: false });
    for (const line of lines) expect(Object.keys(line).sort()).toEqual(["active", "email", "name", "role"]);
  });
  test("the Firebase owner, kept outside the records, is exported once as an owner", () => {
    const lines = membershipRoster([access()]).trim().split("\n").map(line => JSON.parse(line));
    expect(lines.filter(line => line.role === "owner")).toEqual([{ name: "", email: OWNER_EMAIL, role: "owner", active: true }]);
    expect(lines).toHaveLength(2);
  });
  test("owner records are exported with the owner role", () => {
    const lines = membershipRoster([access({ role: "owner", email: "olga@example.com" })]).trim().split("\n").map(line => JSON.parse(line));
    expect(lines).toContainEqual({ name: "Alice", email: "olga@example.com", role: "owner", active: true });
  });
});

describe("shared form checks", () => {
  test("email, password and name rules match the existing account forms", () => {
    expect(validEmail("  alice@example.com ")).toBe("alice@example.com");
    expect(() => validEmail("alice")).toThrow("请填写有效的邮箱地址。");
    expect(() => validateSitePassword("short")).toThrow("请设置 8 至 128 位密码。");
    expect(() => validateSitePassword("long enough", "different")).toThrow("两次输入的密码不一致，请重新输入。");
    expect(() => validateSitePassword("long enough")).not.toThrow();
    expect(validMemberName("  张三 ")).toBe("张三");
    expect(() => validMemberName(" ")).toThrow("请填写 1 至 80 字的成员姓名。");
    expect(() => validMemberName("名".repeat(81))).toThrow("请填写 1 至 80 字的成员姓名。");
  });
});
