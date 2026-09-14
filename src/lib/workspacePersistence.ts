import type { WorkspaceData } from "../types";
import { collectionNames, emptyWorkspace, parseBackup, type CollectionName } from "./workspace";

export const WORKSPACE_STORAGE_KEY = "antico_workspace_v2";
export type WriteGuard = () => void;
type Store = Pick<Storage, "getItem" | "setItem">;
type Locks = Pick<LockManager, "request">;

// A session starts closed, including before React's first effect. Every cleanup
// invalidates callbacks already waiting for a file, lock, or transaction retry.
export function createWriteSession(readIdentity?: () => string | null) {
  let active = false;
  let epoch = 0;
  let identity: string | null = null;
  return {
    activate() { identity = readIdentity?.() ?? null; active = true; epoch++; },
    deactivate() { active = false; epoch++; },
    capture(): WriteGuard {
      const expectedEpoch = epoch;
      const assertCurrent = () => {
        if (!active || epoch !== expectedEpoch)
          throw new Error("工作区已关闭或切换，请在当前页面重新操作。");
        if (readIdentity && (!identity || readIdentity() !== identity))
          throw new Error("登录账号已改变，请在当前账号下重新操作。");
      };
      assertCurrent();
      return assertCurrent;
    },
  };
}

export function validateRecordId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !id || id.includes("/") || id === "." || id === ".."
    || /^__.*__$/.test(id) || ["constructor", "prototype"].includes(id)
    || new TextEncoder().encode(id).length > 1500)
    throw new Error("记录编号无效，不能作为云端文档编号。");
}

export function validateRecord<K extends CollectionName>(key: K, row: unknown, expectedId?: string): WorkspaceData[K][number] {
  if (!collectionNames.includes(key)) throw new Error("未知工作区集合。");
  const parsed = parseBackup({ [key]: [row] });
  const record = parsed[key]![0];
  validateRecordId(record.id);
  if (expectedId !== undefined && record.id !== expectedId)
    throw new Error(`${key} 记录编号与文档路径不一致，请联系管理员修复该记录。`);
  return record;
}

export function validateWorkspaceWrite(next: WorkspaceData): WorkspaceData {
  const parsed = parseBackup(next);
  for (const key of collectionNames) {
    if (!parsed[key]) throw new Error(`${key} 必须是列表。`);
    for (const row of parsed[key]!) validateRecordId(row.id);
  }
  return next;
}

// Bound the complete record before starting an import, including unknown legacy
// fields. The estimate intentionally includes room for field/container encoding.
export function validateCloudRecord<K extends CollectionName>(key: K, row: unknown, expectedId?: string): WorkspaceData[K][number] {
  const record = validateRecord(key, row, expectedId);
  const bytes = (value: unknown, depth: number): number => {
    if (depth > 20) throw new Error("记录嵌套层级过多，无法保存到云端。");
    if (typeof value === "string") return new TextEncoder().encode(value).length + 8;
    if (typeof value === "number" && Number.isFinite(value)) return 12;
    if (value === null || typeof value === "boolean") return 8;
    if (Array.isArray(value)) return 32 + value.reduce((total, item) => total + bytes(item, depth + 1) + 8, 0);
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
      return 32 + Object.entries(value).reduce((total, [field, item]) => total + new TextEncoder().encode(field).length + 16 + bytes(item, depth + 1), 0);
    throw new Error("记录包含无法保存到云端的字段，请检查备份格式。");
  };
  if (bytes(record, 0) + new TextEncoder().encode(record.id).length + 128 > 1024 * 1024)
    throw new Error(`${key} 中编号 ${record.id} 的单条记录过大，请拆分文字或附件后重试。`);
  return record;
}

export function linkedMeetingId(key: CollectionName, row: WorkspaceData[CollectionName][number]): string | null {
  if (key !== "issues" && key !== "attendance") return null;
  const id = (row as { meetingId: string | null }).meetingId;
  if (id === null && key === "issues") return null;
  validateRecordId(id);
  return id;
}

export function requireLocalMeeting(key: CollectionName, row: WorkspaceData[CollectionName][number], data: WorkspaceData, previous?: WorkspaceData[CollectionName][number] | null) {
  const meetingId = linkedMeetingId(key, row);
  if (previous && linkedMeetingId(key, previous) === meetingId) return;
  if (meetingId && !data.meetings.some(meeting => meeting.id === meetingId))
    throw new Error("关联会议不存在或已删除，请重新选择会议。");
}

export function readLocalWorkspace(store: Pick<Storage, "getItem">): WorkspaceData {
  const stored = store.getItem(WORKSPACE_STORAGE_KEY);
  if (stored) return { ...emptyWorkspace(), ...parseBackup(JSON.parse(stored)) };
  const legacy = Object.fromEntries(collectionNames.map(key => [key, JSON.parse(store.getItem(`local_${key}`) || "[]")]));
  return { ...emptyWorkspace(), ...parseBackup(legacy) };
}

export function rawLocalWorkspace(store: Pick<Storage, "getItem">) {
  return { raw: store.getItem(WORKSPACE_STORAGE_KEY), legacy: Object.fromEntries(collectionNames.map(key => [key, store.getItem(`local_${key}`)])) };
}

// Keep read/transform/validate/write synchronous inside the shared origin lock.
// Without Web Locks the same short synchronous section still protects one tab,
// but callers must not advertise cross-tab serialization in that browser.
export function mutateLocalWorkspace(
  transform: (latest: WorkspaceData) => WorkspaceData,
  options: { store: Store; assertCurrent: WriteGuard; locks?: Locks; recover?: boolean },
): Promise<WorkspaceData> {
  const mutate = () => {
    options.assertCurrent();
    let latest: WorkspaceData;
    let recovery: string | undefined;
    try { latest = readLocalWorkspace(options.store); }
    catch (error) {
      if (!options.recover) throw error;
      recovery = JSON.stringify(rawLocalWorkspace(options.store));
      latest = emptyWorkspace();
    }
    const next = validateWorkspaceWrite(transform(latest));
    const serialized = JSON.stringify(next);
    options.assertCurrent();
    if (recovery !== undefined) {
      const base = `${WORKSPACE_STORAGE_KEY}_recovery`;
      let key = base;
      let suffix = 1;
      while (options.store.getItem(key) !== null && options.store.getItem(key) !== recovery) key = `${base}_${suffix++}`;
      options.store.setItem(key, recovery);
    }
    options.store.setItem(WORKSPACE_STORAGE_KEY, serialized);
    return next;
  };
  if (options.locks) return options.locks.request(WORKSPACE_STORAGE_KEY, { mode: "exclusive" }, mutate);
  try { return Promise.resolve(mutate()); } catch (error) { return Promise.reject(error); }
}
