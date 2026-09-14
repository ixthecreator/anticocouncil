import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  getDoc,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  runTransaction,
  writeBatch,
  type Transaction,
} from "firebase/firestore";
import type { Issue, Meeting, WorkspaceData } from "../types";
import { collectionNames, parseBackup, type CollectionName } from "./workspace";
import { linkedMeetingId, validateCloudRecord, validateRecord, validateRecordId, type WriteGuard } from "./workspacePersistence";
import {
  resolveFirebaseConfiguration,
  type SnapshotState,
} from "./firebaseConnection";
export { legacyFirebaseConfiguration } from "./firebaseConnection";

export const firebaseConfiguration = resolveFirebaseConfiguration(
  (import.meta as ImportMeta & { env?: Record<string, unknown> }).env || {},
);

// Firebase is initialized only after a cloud operation or the auth gate asks for it.
// A missing deployment configuration cannot prevent the public/local pages from loading.
export function getFirebaseApp() {
  if (!firebaseConfiguration.config) throw new Error(firebaseConfiguration.error);
  const config = firebaseConfiguration.config;
  const name = `antico-${config.projectId}-${config.appId}`;
  return getApps().find((app) => app.name === name) || initializeApp(config, name);
}
export const getDatabase = () => getFirestore(getFirebaseApp(), firebaseConfiguration.databaseId);
export const getCloudWriteIdentity = () => getAuth(getFirebaseApp()).currentUser?.uid || null;

export function firebaseErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code).replace(/^firestore\//, "") : "";
  if (code === "permission-denied") return "当前账号没有此工作区的读取权限，请联系项目管理员确认成员授权。";
  if (code === "unauthenticated") return "登录状态已失效，请重新登录后重试。";
  if (["unavailable", "deadline-exceeded"].includes(code)) return "暂时无法连接 Firebase，请检查网络后重试。";
  if (["not-found", "failed-precondition", "invalid-argument"].includes(code)) return "Firebase 数据库尚未就绪或配置不匹配，请检查项目和数据库编号。";
  return error instanceof Error ? error.message : "云端连接失败，请检查网络和项目配置后重试。";
}

// Helper functions for CRUD
export const saveDoc = async (collectionName: CollectionName, data: WorkspaceData[CollectionName][number], assertCurrent: WriteGuard) => {
  validateCloudRecord(collectionName, data);
  assertCurrent();
  const docRef = doc(getDatabase(), collectionName, data.id);
  if (collectionName === "issues" || collectionName === "attendance") {
    await runTransaction(getDatabase(), async transaction => {
      assertCurrent();
      const existing = await transaction.get(docRef);
      assertCurrent();
      const previous = existing.exists() ? validateRecord(collectionName, existing.data(), data.id) : null;
      await requireMeeting(transaction, collectionName, data, previous);
      assertCurrent();
      transaction.set(docRef, data, { merge: true });
    });
    return;
  }
  await setDoc(docRef, data, { merge: true });
};

export const removeDoc = async (collectionName: CollectionName, id: string, assertCurrent: WriteGuard) => {
  validateRecordId(id);
  assertCurrent();
  const docRef = doc(getDatabase(), collectionName, id);
  await deleteDoc(docRef);
};

export const subscribeToCollection = (
  collectionName: CollectionName,
  callback: (data: any[], metadata: SnapshotState) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(collection(getDatabase(), collectionName));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      try {
        const data = snapshot.docs.map((document) => validateRecord(collectionName, document.data(), document.id));
        callback(data, {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error("云端记录格式不兼容。"));
      }
    },
    onError,
  );
};

async function requireMeeting(transaction: Transaction, key: CollectionName, row: WorkspaceData[CollectionName][number], previous: WorkspaceData[CollectionName][number] | null) {
  const meetingId = linkedMeetingId(key, row);
  if (previous && linkedMeetingId(key, previous) === meetingId) return;
  if (meetingId && !(await transaction.get(doc(getDatabase(), "meetings", meetingId))).exists())
    throw new Error("关联会议不存在或已删除，请重新选择会议。");
}

export async function changeDoc(
  collectionName: CollectionName,
  id: string,
  change: (data: any) => any,
  assertCurrent: WriteGuard,
) {
  validateRecordId(id);
  assertCurrent();
  const db = getDatabase();
  const ref = doc(db, collectionName, id);
  await runTransaction(db, async (transaction) => {
    assertCurrent();
    const snapshot = await transaction.get(ref);
    assertCurrent();
    const previous = snapshot.exists() ? validateRecord(collectionName, snapshot.data(), id) : null;
    const updated = validateCloudRecord(collectionName, change(previous), id);
    await requireMeeting(transaction, collectionName, updated, previous);
    assertCurrent();
    transaction.set(ref, updated);
  });
}

export function prepareImportedIssue(imported: Issue, latest: Issue | null): Issue {
  const protectedVoteField = (key: string) => key.startsWith("vote") || key === "ballots";
  if (!latest) {
    if (imported.status !== "agenda" || Object.keys(imported).some(protectedVoteField))
      throw new Error(`议题「${imported.title}」包含历史状态或表决记录，须由管理员专用恢复流程处理，普通导入尚未写入该议题。`);
    return imported;
  }
  if (Object.hasOwn(latest, "ballots") || Object.hasOwn(latest, "voters") || ["manual", "members"].includes(latest.voteMode || ""))
    throw new Error(`议题「${latest.title}」仍有旧版投票记录，请管理员先安全转存，再导入备份。`);
  if (latest.id !== imported.id) throw new Error("议题编号与云端文档不一致。");
  const next = { ...latest } as Issue & Record<string, unknown>;
  const frozen = latest.status === "voting" || latest.voteMode === "private" || latest.voteMode === "legacy";
  // Rules permit only these ordinary content fields to be restored here. Start
  // from the server record so future/legacy protected metadata also survives.
  for (const field of ["title", "description", "category", "priority", "discussion", "signature", "dueDate", "updatedAt", "serialNumber"] as const) {
    if (frozen && ["title", "description", "category"].includes(field)) continue;
    if (Object.hasOwn(imported, field)) (next as Record<string, unknown>)[field] = imported[field];
  }
  return next;
}

function prepareImportedMeeting(imported: Meeting, latest: Meeting | null): Meeting {
  return { ...imported, issueIds: latest?.issueIds || [], ...(latest ? { createdAt: latest.createdAt } : {}) };
}

export async function importDocs(data: Partial<WorkspaceData>, assertCurrent: WriteGuard) {
  const parsed = parseBackup(data);
  const entries = collectionNames.flatMap(key => (parsed[key] || []).map(row => ({ key, row: validateCloudRecord(key, row), source: row })));
  assertCurrent();
  const db = getDatabase();
  for (const entry of entries) {
    if (entry.key !== "meetings" && entry.key !== "issues") continue;
    assertCurrent();
    const existing = await getDoc(doc(db, entry.key, entry.row.id));
    assertCurrent();
    if (entry.key === "meetings") {
      const previous = existing.exists() ? validateRecord("meetings", existing.data(), entry.row.id) : null;
      entry.row = prepareImportedMeeting(entry.source as Meeting, previous);
    } else {
      const previous = existing.exists() ? validateRecord("issues", existing.data(), entry.row.id) : null;
      entry.row = prepareImportedIssue(entry.source as Issue, previous);
    }
    validateCloudRecord(entry.key, entry.row);
  }
  // Imported meetings are written first. Existing parents are checked before any
  // batch, so a broken reference cannot make an otherwise valid backup partial.
  const meetings = new Map((parsed.meetings || []).map(meeting => [meeting.id, true]));
  for (const { key, row } of entries) {
    const id = linkedMeetingId(key, row);
    if (!id) continue;
    if (!meetings.has(id)) {
      assertCurrent();
      const parent = await getDoc(doc(db, "meetings", id));
      assertCurrent();
      meetings.set(id, parent.exists());
    }
    if (!meetings.get(id)) {
      assertCurrent();
      const existing = await getDoc(doc(db, key, row.id));
      assertCurrent();
      if (!existing.exists() || linkedMeetingId(key, validateRecord(key, existing.data(), row.id)) !== id)
        throw new Error("备份有关联会议缺失，请同时导入会议或先恢复会议记录。");
    }
  }
  let completed = 0;
  try {
    for (let start = 0; start < entries.length; start += 200) {
      assertCurrent();
      const group: typeof entries = [];
      let size = 0;
      let count = 0;
      const parents = new Set<string>();
      for (const entry of entries.slice(start, start + 200)) {
        const { key, row } = entry;
        const bytes = new TextEncoder().encode(JSON.stringify(row)).length;
        const parent = linkedMeetingId(key, row);
        if (count && (size + bytes > 7 * 1024 * 1024 || parent && !parents.has(parent) && parents.size >= 10)) break;
        group.push(entry);
        if (parent) parents.add(parent);
        size += bytes;
        count++;
      }
      assertCurrent();
      if (group.some(entry => entry.key === "issues" || entry.key === "meetings")) {
        await runTransaction(db, async transaction => {
          assertCurrent();
          const writes: Array<{ key: CollectionName; row: WorkspaceData[CollectionName][number] }> = [];
          for (const entry of group) {
            let row = entry.row;
            if (entry.key === "issues" || entry.key === "meetings") {
              const existing = await transaction.get(doc(db, entry.key, entry.row.id));
              assertCurrent();
              row = entry.key === "issues"
                ? prepareImportedIssue(entry.source as Issue, existing.exists() ? validateRecord("issues", existing.data(), entry.row.id) : null)
                : prepareImportedMeeting(entry.source as Meeting, existing.exists() ? validateRecord("meetings", existing.data(), entry.row.id) : null);
              validateCloudRecord(entry.key, row);
            }
            writes.push({ key: entry.key, row });
          }
          // All reads precede all writes; retries re-merge the current protected
          // fields if a vote starts or closes after the initial import preflight.
          assertCurrent();
          for (const { key, row } of writes) transaction.set(doc(db, key, row.id), row);
        });
      } else {
        const batch = writeBatch(db);
        for (const { key, row } of group) batch.set(doc(db, key, row.id), row);
        assertCurrent();
        await batch.commit();
      }
      completed += count;
      start -= 200 - count;
    }
  } catch (error) {
    throw new Error(
      `导入中断，已确认完成 ${completed} / ${entries.length} 条。${error instanceof Error ? error.message : "云端未确认本批次。"} 请确认当前工作区后再重试，同编号记录不会重复。`,
    );
  }
}
