"use strict";
// Membership changes for the council workspace on Tencent CloudBase. Members cannot
// write these records themselves; every change is checked here.

const ROLES = ["member", "admin", "owner"];
const ASSIGNABLE_ROLES = ["member", "admin"];

class MembershipRefusal extends Error {}
const refuse = message => { throw new MembershipRefusal(message); };

const normalEmail = value => String(value || "").trim().toLowerCase();
const text = value => typeof value === "string" ? value.trim() : "";
function memberName(value) {
  const name = text(value);
  if (!name || name.length > 80) refuse("请填写 1 至 80 字的成员姓名。");
  return name;
}
function targetUid(input) {
  const uid = text(input.uid);
  if (!uid) refuse("缺少成员编号，请刷新成员列表。");
  return uid;
}
const isAccess = row => !!row && typeof row.name === "string" && typeof row.email === "string"
  && ROLES.includes(row.role) && typeof row.active === "boolean";
const isManager = row => isAccess(row) && row.active && (row.role === "admin" || row.role === "owner");
const accessRecord = (uid, row) => ({ uid, name: row.name, email: row.email, role: row.role, active: row.active });
// Mirrors canManageMember in src/lib/accessPolicy.ts. Owners are set in the roster, never here.
const canManage = (actorUid, actor, targetUid, target) => actorUid !== targetUid && target.role !== "owner"
  && (actor.role === "owner" || actor.role === "admin" && target.role === "member");

/**
 * `store` reads and writes the database:
 *   get(collection, id), list(collection), remove(collection, id),
 *   transaction(work) where work receives { get, set, update, remove } bound to one transaction.
 * `caller` is the signed-in account: { uid, email, name }, read on the server.
 */
function createMembership(store, now = () => Date.now()) {
  const actions = {
    // On first sign-in, a roster entry for the account's email becomes its membership.
    // Each entry is used once, so deleting a membership never brings an old role back.
    async claim(caller) {
      if (await store.get("workspaceAccess", caller.uid)) return { claimed: false };
      const email = normalEmail(caller.email);
      if (!email) return { claimed: false };
      const entry = (await store.list("accessRoster")).find(row => normalEmail(row.email) === email
        && ROLES.includes(row.role) && (!row.claimedBy || row.claimedBy === caller.uid));
      if (!entry) return { claimed: false };
      return store.transaction(async tx => {
        if (await tx.get("workspaceAccess", caller.uid)) return { claimed: false };
        const current = await tx.get("accessRoster", entry._id);
        if (!current || current.claimedBy && current.claimedBy !== caller.uid || !ROLES.includes(current.role)) return { claimed: false };
        const name = (text(current.name) || text(caller.name) || email).slice(0, 80);
        await tx.set("workspaceAccess", caller.uid, accessRecord(caller.uid, { name, email: caller.email, role: current.role, active: current.active !== false }));
        await tx.update("accessRoster", entry._id, { claimedBy: caller.uid, claimedAt: now() });
        if (await tx.get("accessRequests", caller.uid)) await tx.remove("accessRequests", caller.uid);
        return { claimed: true };
      });
    },
    async request(caller, input) {
      const name = memberName(input.name);
      if (!caller.email) refuse("无法确认当前账号的邮箱，请退出后重新登录。");
      return store.transaction(async tx => {
        if (await tx.get("workspaceAccess", caller.uid)) refuse("此账号已有授权记录，请刷新页面。");
        await tx.set("accessRequests", caller.uid, { uid: caller.uid, name, email: caller.email, requestedAt: now() });
        return {};
      });
    },
    async list(caller) {
      if (!isManager(await store.get("workspaceAccess", caller.uid))) refuse("只有管理员可以管理成员。");
      const [members, requests] = await Promise.all([store.list("workspaceAccess"), store.list("accessRequests")]);
      return {
        members: members.filter(isAccess).map(row => accessRecord(row.uid || row._id, row)),
        requests: requests.filter(row => typeof row.name === "string" && typeof row.email === "string")
          .map(row => ({ uid: row.uid || row._id, name: row.name, email: row.email })),
      };
    },
    async approve(caller, input) {
      const uid = targetUid(input);
      if (uid === caller.uid) refuse("不能审批自己的申请。");
      return store.transaction(async tx => {
        if (!isManager(await tx.get("workspaceAccess", caller.uid))) refuse("只有管理员可以管理成员。");
        const request = await tx.get("accessRequests", uid);
        if (!request || typeof request.name !== "string" || typeof request.email !== "string") refuse("申请已处理或内容无效，请刷新成员列表。");
        if (await tx.get("workspaceAccess", uid)) refuse("此成员已有授权记录，请在成员列表中管理。");
        await tx.set("workspaceAccess", uid, accessRecord(uid, { name: request.name, email: request.email, role: "member", active: true }));
        await tx.remove("accessRequests", uid);
        return {};
      });
    },
    async decline(caller, input) {
      const uid = targetUid(input);
      if (uid === caller.uid) refuse("不能审批自己的申请。");
      if (!isManager(await store.get("workspaceAccess", caller.uid))) refuse("只有管理员可以管理成员。");
      await store.remove("accessRequests", uid);
      return {};
    },
    async update(caller, input) {
      const uid = targetUid(input);
      const changes = {};
      if (input.active !== undefined) {
        if (typeof input.active !== "boolean") refuse("无效的启用状态。");
        changes.active = input.active;
      }
      if (input.role !== undefined) {
        if (!ASSIGNABLE_ROLES.includes(input.role)) refuse("无效的成员角色。");
        changes.role = input.role;
      }
      if (!Object.keys(changes).length) refuse("没有需要保存的修改。");
      return store.transaction(async tx => {
        const actor = await tx.get("workspaceAccess", caller.uid);
        const target = await tx.get("workspaceAccess", uid);
        if (!isManager(actor)) refuse("只有管理员可以管理成员。");
        if (!isAccess(target)) refuse("找不到此成员的授权记录，请刷新成员列表。");
        if (!canManage(caller.uid, actor, uid, target)) refuse("不能修改此成员的授权。");
        if (changes.role !== undefined && actor.role !== "owner") refuse("只有议会所有者可以调整管理员角色。");
        await tx.update("workspaceAccess", uid, changes);
        return {};
      });
    },
  };

  // Answers { ok: true, ...result } or { ok: false, message } for the site to show.
  return async function run(caller, event) {
    try {
      const input = event && typeof event === "object" ? event : {};
      const action = typeof input.action === "string" ? input.action : "";
      if (!Object.prototype.hasOwnProperty.call(actions, action)) refuse("未知的成员操作。");
      if (!caller || !caller.uid) refuse("登录状态已失效，请重新登录。");
      return { ok: true, ...(await actions[action](caller, input)) };
    } catch (error) {
      if (error instanceof MembershipRefusal) return { ok: false, message: error.message };
      console.error("membership failed", error);
      return { ok: false, message: "成员服务暂时出错，请稍后重试。" };
    }
  };
}

module.exports = { createMembership };
