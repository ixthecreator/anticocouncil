import { expect, test } from "bun:test";
import { emptyWorkspace } from "./workspace";
import {
  WORKSPACE_STORAGE_KEY, createWriteSession, mutateLocalWorkspace, readLocalWorkspace,
  requireLocalMeeting, validateCloudRecord, validateRecord,
} from "./workspacePersistence";

const item = { id: "inventory-1", title: "纸张", quantity: 10, location: "资料室", keeper: "张三", notes: "" };
function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const current = () => {};

test("writes cannot start before mount or after cleanup, including recovery imports", async () => {
  const session = createWriteSession();
  expect(() => session.capture()).toThrow("工作区已关闭");
  session.activate();
  const guard = session.capture();
  session.deactivate();
  const store = storage({ [WORKSPACE_STORAGE_KEY]: "broken" });
  await expect(mutateLocalWorkspace(() => emptyWorkspace(), { store, assertCurrent: guard, recover: true })).rejects.toThrow("工作区已关闭");
  expect(store.values).toEqual(new Map([[WORKSPACE_STORAGE_KEY, "broken"]]));
  expect(() => session.capture()).toThrow("工作区已关闭");
  session.activate();
  expect(() => guard()).toThrow("工作区已关闭");
  expect(() => session.capture()()).not.toThrow();
});

test("an account change rejects both queued work and a fresh action from the stale workspace", () => {
  let uid: string | null = "account-a";
  const session = createWriteSession(() => uid);
  session.activate();
  const guard = session.capture();
  uid = "account-b";
  expect(() => guard()).toThrow("登录账号已改变");
  expect(() => session.capture()).toThrow("登录账号已改变");
  uid = null;
  expect(() => guard()).toThrow("登录账号已改变");
});

test("invalid changes leave the exact original local backup readable and untouched", async () => {
  const original = JSON.stringify({ ...emptyWorkspace(), inventory: [item] });
  const store = storage({ [WORKSPACE_STORAGE_KEY]: original });
  for (const quantity of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(mutateLocalWorkspace(latest => ({ ...latest, inventory: [{ ...item, quantity }] }), { store, assertCurrent: current })).rejects.toThrow("非负整数");
    expect(store.getItem(WORKSPACE_STORAGE_KEY)).toBe(original);
  }
  expect(readLocalWorkspace(store).inventory).toEqual([item]);
});

test("different tabs serialize their read-modify-write using the same lock and retain both edits", async () => {
  const store = storage({ [WORKSPACE_STORAGE_KEY]: JSON.stringify({ ...emptyWorkspace(), inventory: [item] }) });
  let release!: () => void;
  let queue: Promise<unknown> = new Promise<void>(resolve => { release = resolve; });
  const names: string[] = [];
  const locks = { request: (name: string, _options: unknown, action: () => unknown) => {
    names.push(name);
    const next = queue.then(action);
    queue = next.catch(() => {});
    return next;
  } } as unknown as Pick<LockManager, "request">;
  const first = mutateLocalWorkspace(latest => ({ ...latest, inventory: latest.inventory.map(row => ({ ...row, quantity: row.quantity - 1 })) }), { store, assertCurrent: current, locks });
  const second = mutateLocalWorkspace(latest => ({ ...latest, inventory: latest.inventory.map(row => ({ ...row, notes: `当前剩余 ${row.quantity}` })) }), { store, assertCurrent: current, locks });
  expect(readLocalWorkspace(store).inventory[0]).toEqual(item);
  release();
  await Promise.all([first, second]);
  expect(names).toEqual([WORKSPACE_STORAGE_KEY, WORKSPACE_STORAGE_KEY]);
  expect(readLocalWorkspace(store).inventory[0]).toEqual({ ...item, quantity: 9, notes: "当前剩余 9" });
});

test("cleanup while waiting for a lock prevents the queued mutation from reading or writing", async () => {
  const session = createWriteSession();
  session.activate();
  const store = storage();
  let start!: () => void;
  const locks = { request: (_name: string, _options: unknown, action: () => unknown) => new Promise((resolve, reject) => {
    start = () => { try { resolve(action()); } catch (error) { reject(error); } };
  }) } as unknown as Pick<LockManager, "request">;
  let changed = false;
  const pending = mutateLocalWorkspace(latest => { changed = true; return latest; }, { store, assertCurrent: session.capture(), locks });
  session.deactivate();
  start();
  await expect(pending).rejects.toThrow("工作区已关闭");
  expect(changed).toBe(false);
  expect(store.values.size).toBe(0);
});

test("recovery checks the latest store under the lock and keeps earlier damaged snapshots", async () => {
  const recoveryKey = `${WORKSPACE_STORAGE_KEY}_recovery`;
  const store = storage({ [WORKSPACE_STORAGE_KEY]: "damaged again", [recoveryKey]: "earlier damaged backup" });
  await mutateLocalWorkspace(() => ({ ...emptyWorkspace(), inventory: [item] }), { store, assertCurrent: current, recover: true });
  expect(store.getItem(recoveryKey)).toBe("earlier damaged backup");
  expect(JSON.parse(store.getItem(`${recoveryKey}_1`)!).raw).toBe("damaged again");
  expect(readLocalWorkspace(store).inventory).toEqual([item]);
  await mutateLocalWorkspace(latest => ({ ...latest, members: [{ id: "m", name: "新成员", role: "编辑", avatarSymbol: "人" }] }), { store, assertCurrent: current, recover: true });
  expect(readLocalWorkspace(store).inventory).toEqual([item]);
  expect(readLocalWorkspace(store).members).toHaveLength(1);
});

test("a validation or quota failure during recovery never destroys the unreadable original", async () => {
  const store = storage({ [WORKSPACE_STORAGE_KEY]: "unreadable original" });
  await expect(mutateLocalWorkspace(() => ({ ...emptyWorkspace(), inventory: [{ ...item, quantity: -1 }] }), { store, assertCurrent: current, recover: true })).rejects.toThrow();
  expect(store.values.size).toBe(1);
  const limited = { ...store, setItem: () => { throw new Error("quota exceeded"); } };
  await expect(mutateLocalWorkspace(() => emptyWorkspace(), { store: limited, assertCurrent: current, recover: true })).rejects.toThrow("quota exceeded");
  expect(store.getItem(WORKSPACE_STORAGE_KEY)).toBe("unreadable original");
});

test("path changes and Firestore-invalid identifiers are rejected without rewriting old IDs", () => {
  expect(() => validateRecord("inventory", item, "different-path")).toThrow("文档路径不一致");
  for (const id of [".", "..", "__hidden__", "folder/item", "中".repeat(501)])
    expect(() => validateRecord("inventory", { ...item, id })).toThrow();
  expect(validateRecord("inventory", { ...item, id: "会议__成员" }).id).toBe("会议__成员");
});

test("cloud import preflight rejects oversized or unsupported unknown fields", () => {
  expect(() => validateCloudRecord("inventory", { ...item, notes: "中".repeat(400000) })).toThrow("单条记录过大");
  expect(() => validateCloudRecord("inventory", { ...item, extra: undefined })).toThrow("无法保存到云端");
  expect(() => validateCloudRecord("inventory", { ...item, extra: [Infinity] })).toThrow("无法保存到云端");
  expect(validateCloudRecord("inventory", { ...item, legacy: { checked: true } })).toMatchObject(item);
});

test("linked writes require an existing meeting while an unassigned issue remains valid", () => {
  const attendance = { id: "a", meetingId: "missing", memberId: "m", memberName: "成员", checkedInAt: "", reportStatus: "pending" as const, reportNote: "" };
  expect(() => requireLocalMeeting("attendance", attendance, emptyWorkspace())).toThrow("关联会议不存在");
  expect(() => requireLocalMeeting("attendance", { ...attendance, reportNote: "补记" }, emptyWorkspace(), attendance)).not.toThrow();
  expect(() => requireLocalMeeting("issues", { meetingId: null } as never, emptyWorkspace())).not.toThrow();
});
