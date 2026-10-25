import { describe, expect, mock, test } from "bun:test";
import { createMembership } from "./membership/membership.js";

type Row = Record<string, any>;
// An in-memory database. Transaction writes apply only when the work completes, so a
// refused action leaves nothing behind, as a rolled-back CloudBase transaction would.
function memoryStore(initial: Record<string, Record<string, Row>> = {}) {
  const tables = new Map<string, Map<string, Row>>();
  const table = (name: string) => tables.get(name) || tables.set(name, new Map()).get(name)!;
  for (const [name, rows] of Object.entries(initial)) for (const [id, row] of Object.entries(rows)) table(name).set(id, { ...row });
  const read = (name: string, id: string) => table(name).has(id) ? { _id: id, ...table(name).get(id) } : null;
  const store = {
    get: async (name: string, id: string) => read(name, id),
    list: async (name: string) => [...table(name).keys()].map(id => read(name, id)),
    remove: async (name: string, id: string) => { table(name).delete(id); },
    transaction: async (work: (tx: Row) => Promise<unknown>) => {
      const writes: (() => void)[] = [];
      const result = await work({
        get: async (name: string, id: string) => read(name, id),
        set: async (name: string, id: string, row: Row) => { writes.push(() => table(name).set(id, { ...row })); },
        update: async (name: string, id: string, changes: Row) => { writes.push(() => table(name).set(id, { ...table(name).get(id), ...changes })); },
        remove: async (name: string, id: string) => { writes.push(() => table(name).delete(id)); },
      });
      writes.forEach(write => write());
      return result;
    },
  };
  return { store, row: (name: string, id: string) => table(name).get(id), size: (name: string) => table(name).size };
}
const person = (uid: string, role = "member", active = true) => ({ uid, name: uid, email: `${uid}@example.com`, role, active });
const caller = (uid: string, email = `${uid}@example.com`, name = "") => ({ uid, email, name });
const council = () => memoryStore({
  workspaceAccess: { owner: person("owner", "owner"), admin: person("admin", "admin"), alice: person("alice"), carol: person("carol", "admin"), idle: person("idle", "admin", false) },
  accessRequests: { bob: { uid: "bob", name: "Bob", email: "bob@example.com", requestedAt: 1 } },
});

describe("claiming the migrated roster", () => {
  const roster = () => memoryStore({
    accessRoster: {
      r1: { name: "旧管理员", email: "Old.Admin@Example.com", role: "admin", active: true },
      r2: { name: "", email: "owner@example.com", role: "owner", active: true },
      r3: { name: "停用者", email: "gone@example.com", role: "member", active: false },
      r4: { name: "无效", email: "odd@example.com", role: "chair", active: true },
    },
    accessRequests: { u1: { uid: "u1", name: "旧管理员", email: "old.admin@example.com", requestedAt: 1 } },
  });

  test("an account gets the role listed for its email once, whatever the letter case", async () => {
    const { store, row } = roster();
    const run = createMembership(store, () => 42);
    expect(await run(caller("u1", "old.admin@example.com"), { action: "claim" })).toEqual({ ok: true, claimed: true });
    expect(row("workspaceAccess", "u1")).toEqual({ uid: "u1", name: "旧管理员", email: "old.admin@example.com", role: "admin", active: true });
    expect(row("accessRoster", "r1")).toMatchObject({ claimedBy: "u1", claimedAt: 42 });
    // A pending application is no longer needed.
    expect(row("accessRequests", "u1")).toBeUndefined();
    expect(await run(caller("u1", "old.admin@example.com"), { action: "claim" })).toEqual({ ok: true, claimed: false });
  });

  test("a used entry cannot be claimed by another account, even after its membership is removed", async () => {
    const { store } = roster();
    const run = createMembership(store);
    await run(caller("u1", "old.admin@example.com"), { action: "claim" });
    await store.remove("workspaceAccess", "u1");
    expect(await run(caller("u9", "old.admin@example.com"), { action: "claim" })).toEqual({ ok: true, claimed: false });
  });

  test("owners keep their sign-up name; stopped members stay stopped; unknown roles grant nothing", async () => {
    const { store, row } = roster();
    const run = createMembership(store);
    await run(caller("o1", "owner@example.com", "所有者本人"), { action: "claim" });
    expect(row("workspaceAccess", "o1")).toMatchObject({ name: "所有者本人", role: "owner", active: true });
    await run(caller("g1", "gone@example.com"), { action: "claim" });
    expect(row("workspaceAccess", "g1")).toMatchObject({ role: "member", active: false });
    expect(await run(caller("x1", "odd@example.com"), { action: "claim" })).toEqual({ ok: true, claimed: false });
    expect(await run(caller("n1", "nobody@example.com"), { action: "claim" })).toEqual({ ok: true, claimed: false });
    expect(row("workspaceAccess", "x1")).toBeUndefined();
  });
});

describe("applications", () => {
  test("an application records the account's server-side email, not one sent by the site", async () => {
    const { store, row } = memoryStore();
    const run = createMembership(store, () => 7);
    expect(await run(caller("dan", "dan@example.com"), { action: "request", name: " Dan ", email: "forged@example.com" })).toEqual({ ok: true });
    expect(row("accessRequests", "dan")).toEqual({ uid: "dan", name: "Dan", email: "dan@example.com", requestedAt: 7 });
    expect(await run(caller("dan"), { action: "request", name: "" })).toEqual({ ok: false, message: "请填写 1 至 80 字的成员姓名。" });
  });

  test("members cannot apply again or replace their membership with an application", async () => {
    const { store } = council();
    const run = createMembership(store);
    expect(await run(caller("alice"), { action: "request", name: "Alice" })).toEqual({ ok: false, message: "此账号已有授权记录，请刷新页面。" });
  });

  test("an administrator approves an application as an ordinary, active member", async () => {
    const { store, row } = council();
    const run = createMembership(store);
    expect(await run(caller("admin"), { action: "approve", uid: "bob" })).toEqual({ ok: true });
    expect(row("workspaceAccess", "bob")).toEqual({ uid: "bob", name: "Bob", email: "bob@example.com", role: "member", active: true });
    expect(row("accessRequests", "bob")).toBeUndefined();
    expect(await run(caller("admin"), { action: "approve", uid: "bob" })).toEqual({ ok: false, message: "申请已处理或内容无效，请刷新成员列表。" });
  });

  test("members, stopped administrators and applicants cannot approve or decline", async () => {
    const { store, size } = council();
    const run = createMembership(store);
    for (const uid of ["alice", "idle", "stranger"]) {
      expect(await run(caller(uid), { action: "approve", uid: "bob" })).toEqual({ ok: false, message: "只有管理员可以管理成员。" });
      expect(await run(caller(uid), { action: "decline", uid: "bob" })).toEqual({ ok: false, message: "只有管理员可以管理成员。" });
    }
    expect(size("accessRequests")).toBe(1);
    expect(await run(caller("bob"), { action: "approve", uid: "bob" })).toEqual({ ok: false, message: "不能审批自己的申请。" });
  });

  test("declining removes the application only", async () => {
    const { store, size } = council();
    const run = createMembership(store);
    expect(await run(caller("admin"), { action: "decline", uid: "bob" })).toEqual({ ok: true });
    expect(size("accessRequests")).toBe(0);
    expect(size("workspaceAccess")).toBe(5);
  });
});

describe("managing members", () => {
  test("only active administrators and owners can list members and applications", async () => {
    const { store } = council();
    const run = createMembership(store);
    const listed = await run(caller("admin"), { action: "list" }) as Row;
    expect(listed.ok).toBe(true);
    expect(listed.members.map((member: Row) => member.uid).sort()).toEqual(["admin", "alice", "carol", "idle", "owner"]);
    expect(listed.requests).toEqual([{ uid: "bob", name: "Bob", email: "bob@example.com" }]);
    expect(await run(caller("alice"), { action: "list" })).toEqual({ ok: false, message: "只有管理员可以管理成员。" });
    expect(await run(caller("idle"), { action: "list" })).toEqual({ ok: false, message: "只有管理员可以管理成员。" });
  });

  test("administrators can stop and restore ordinary members, but not change roles", async () => {
    const { store, row } = council();
    const run = createMembership(store);
    expect(await run(caller("admin"), { action: "update", uid: "alice", active: false })).toEqual({ ok: true });
    expect(row("workspaceAccess", "alice")!.active).toBe(false);
    expect(await run(caller("admin"), { action: "update", uid: "alice", role: "admin" })).toEqual({ ok: false, message: "只有议会所有者可以调整管理员角色。" });
    expect(await run(caller("admin"), { action: "update", uid: "carol", active: false })).toEqual({ ok: false, message: "不能修改此成员的授权。" });
  });

  test("owners can change roles, but no one can change an owner or themselves, or appoint an owner", async () => {
    const { store, row } = council();
    const run = createMembership(store);
    expect(await run(caller("owner"), { action: "update", uid: "alice", role: "admin" })).toEqual({ ok: true });
    expect(row("workspaceAccess", "alice")!.role).toBe("admin");
    expect(await run(caller("owner"), { action: "update", uid: "carol", role: "member", active: false })).toEqual({ ok: true });
    expect(row("workspaceAccess", "carol")).toMatchObject({ role: "member", active: false });
    expect(await run(caller("admin"), { action: "update", uid: "owner", active: false })).toEqual({ ok: false, message: "不能修改此成员的授权。" });
    expect(await run(caller("owner"), { action: "update", uid: "owner", active: false })).toEqual({ ok: false, message: "不能修改此成员的授权。" });
    expect(await run(caller("owner"), { action: "update", uid: "alice", role: "owner" })).toEqual({ ok: false, message: "无效的成员角色。" });
    expect(await run(caller("owner"), { action: "update", uid: "alice", active: "no" })).toEqual({ ok: false, message: "无效的启用状态。" });
    expect(await run(caller("owner"), { action: "update", uid: "nobody", active: false })).toEqual({ ok: false, message: "找不到此成员的授权记录，请刷新成员列表。" });
  });
});

test("unknown actions, missing callers and unexpected failures get a safe answer", async () => {
  const { store } = council();
  const run = createMembership(store);
  expect(await run(caller("admin"), { action: "drop" })).toEqual({ ok: false, message: "未知的成员操作。" });
  expect(await run(null, { action: "list" })).toEqual({ ok: false, message: "登录状态已失效，请重新登录。" });
  const logged = mock(() => {});
  const original = console.error;
  console.error = logged;
  try {
    const broken = createMembership({ ...store, get: async () => { throw new Error("database down"); } });
    expect(await broken(caller("admin"), { action: "list" })).toEqual({ ok: false, message: "成员服务暂时出错，请稍后重试。" });
  } finally {
    console.error = original;
  }
  expect(logged).toHaveBeenCalledTimes(1);
});
