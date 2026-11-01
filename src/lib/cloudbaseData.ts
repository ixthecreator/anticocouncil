import { getCloudbaseApp, type CloudbaseCollection, type CloudbaseRecord, type CloudbaseResult } from "./cloudbaseApp";
import type { SnapshotState } from "./cloudConnection";
import { withoutNamedBallots } from "./workspace";

// Every write stores a fresh revision. A change is saved only while the record still
// carries the revision it was read with, so concurrent edits are reapplied, never lost.
// CloudBase offers transactions only on the server, so this replaces the Firestore one.
const REVISION = "syncRevision";
const serviceFields = new Set(["_id", "_openid", REVISION]);
const newRevision = () => crypto.randomUUID();
// A cached or unconfirmed CloudBase snapshot does not exist: every watch answer is the server's.
const serverSnapshot: SnapshotState = { fromCache: false, hasPendingWrites: false };

export function cloudbaseErrorMessage(error: unknown): string {
  const record = typeof error === "object" && error ? error as Record<string, unknown> : {};
  const code = String(record.code || record.errCode || "");
  if (/PERMISSION_DENIED/i.test(code)) return "当前账号没有此工作区的读取权限，请联系项目管理员确认成员授权。";
  if (/UNAUTHENTICATED|ACCESS_TOKEN|TOKEN_EXPIRED|NOT_LOGIN/i.test(code)) return "登录状态已失效，请重新登录后重试。";
  if (/COLLECTION_NOT_EXIST|ENV_NOT_EXIST|INVALID_ENV/i.test(code)) return "云开发数据库尚未就绪或配置不匹配，请检查环境编号和集合。";
  if (/FUNCTION.*NOT_?(FOUND|EXIST)|ResourceNotFound/i.test(code)) return "云开发的成员服务尚未部署，请联系管理员。";
  if (/NETWORK|TIMEOUT|UNAVAILABLE|CONNECTION/i.test(code)) return "暂时无法连接云开发，请检查网络后重试。";
  if (error instanceof Error && error.message) return error.message;
  return code ? `云端操作失败（${code}），请稍后重试。` : "云端连接失败，请检查网络和项目配置后重试。";
}

// The SDK can report a service error in `code` instead of throwing it.
function checked<T extends CloudbaseResult>(result: T): T {
  if (result && typeof result.code === "string" && result.code)
    throw Object.assign(new Error(cloudbaseErrorMessage(result)), { code: result.code });
  return result;
}
// Keeps the service's code on the error so callers can still tell failures apart.
function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  const record = typeof error === "object" && error ? error as Record<string, unknown> : {};
  return Object.assign(new Error(cloudbaseErrorMessage(error)), { code: String(record.code || record.errCode || "") });
}

export function readRow(document: CloudbaseRecord): Record<string, unknown> {
  const row = Object.fromEntries(Object.entries(document).filter(([key]) => !serviceFields.has(key)));
  if (typeof row.id !== "string" && typeof document._id === "string") row.id = document._id;
  return row;
}
// Leaves out service fields, and keeps named ballots out of shared records.
function storable(collection: string, record: Record<string, unknown>) {
  const row = collection === "issues" ? withoutNamedBallots(record) : record;
  return Object.fromEntries(Object.entries(row).filter(([key, value]) => !serviceFields.has(key) && value !== undefined));
}
async function readDocument(collection: CloudbaseCollection, id: string): Promise<CloudbaseRecord | null> {
  const { data } = checked(await collection.doc(id).get());
  const document = Array.isArray(data) ? data[0] : data;
  return document && typeof document === "object" ? document : null;
}
const database = async () => (await getCloudbaseApp()).database();

// `where` narrows the watch to matching records, as security rules on a collection may require.
export function subscribeToCollection(
  name: string,
  callback: (rows: any[], metadata: SnapshotState) => void,
  onError: (error: Error) => void,
  where?: CloudbaseRecord,
): () => void {
  let active = true;
  let watcher: { close(): void } | undefined;
  database().then(db => {
    if (!active) return;
    const collection = db.collection(name);
    watcher = (where ? collection.where(where) : collection).watch({
      onChange: snapshot => {
        if (!active) return;
        const docs = Array.isArray(snapshot.docs) ? snapshot.docs : Object.values(snapshot.docs || {});
        callback(docs.map(readRow), serverSnapshot);
      },
      onError: error => { if (active) onError(asError(error)); },
    });
  }).catch(error => { if (active) onError(asError(error)); });
  return () => { active = false; watcher?.close(); };
}

export async function saveRecord(name: string, record: any) {
  const db = await database();
  checked(await db.collection(name).doc(record.id).set({ ...storable(name, record), [REVISION]: newRevision() }));
}

export async function removeRecord(name: string, id: string) {
  const db = await database();
  checked(await db.collection(name).doc(id).remove());
}

export async function changeRecord(name: string, id: string, change: (record: any) => any) {
  const db = await database();
  const collection = db.collection(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await readDocument(collection, id);
    const next = storable(name, change(current ? readRow(current) : null));
    const revision = newRevision();
    if (!current) {
      try {
        checked(await collection.add({ ...next, _id: id, [REVISION]: revision }));
        return;
      } catch (error) {
        // Someone else created the record first; read theirs and apply the change to it.
        if (await readDocument(collection, id)) continue;
        throw error;
      }
    }
    const update: CloudbaseRecord = { [REVISION]: revision };
    // set() replaces a nested value whole; a plain object would be merged into the old one.
    for (const [key, value] of Object.entries(next))
      update[key] = value !== null && typeof value === "object" ? db.command.set(value) : value;
    for (const key of Object.keys(current))
      if (!serviceFields.has(key) && !(key in next)) update[key] = db.command.remove();
    const expected = typeof current[REVISION] === "string" ? current[REVISION] : db.command.exists(false);
    const { updated } = checked(await collection.where({ _id: id, [REVISION]: expected }).update(update));
    if (updated === 1) return;
  }
  throw new Error("记录正被其他成员同时修改，请稍后重试。");
}

export async function importRecords(data: Record<string, any[]>) {
  const db = await database();
  const entries = Object.entries(data).flatMap(([key, rows]) => rows.map(row => ({ key, row })));
  let completed = 0;
  try {
    // A few writes at a time keeps a large backup within the service's request limits.
    for (let start = 0; start < entries.length; start += 5) {
      const batch = entries.slice(start, start + 5);
      await Promise.all(batch.map(async ({ key, row }) => {
        checked(await db.collection(key).doc(row.id).set({ ...storable(key, row), [REVISION]: newRevision() }));
      }));
      completed += batch.length;
    }
  } catch {
    throw new Error(`导入中断，已完成 ${completed} / ${entries.length} 条。可重新导入同一备份继续，同编号记录不会重复。`);
  }
}
