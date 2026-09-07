import { getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
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

export function firebaseErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code).replace(/^firestore\//, "") : "";
  if (code === "permission-denied") return "当前账号没有此工作区的读取权限，请联系项目管理员确认成员授权。";
  if (code === "unauthenticated") return "登录状态已失效，请重新登录后重试。";
  if (["unavailable", "deadline-exceeded"].includes(code)) return "暂时无法连接 Firebase，请检查网络后重试。";
  if (["not-found", "failed-precondition", "invalid-argument"].includes(code)) return "Firebase 数据库尚未就绪或配置不匹配，请检查项目和数据库编号。";
  return error instanceof Error ? error.message : "云端连接失败，请检查网络和项目配置后重试。";
}

// Helper functions for CRUD
export const saveDoc = async (collectionName: string, data: any) => {
  const docRef = doc(getDatabase(), collectionName, data.id);
  await setDoc(docRef, data, { merge: true });
};

export const removeDoc = async (collectionName: string, id: string) => {
  const docRef = doc(getDatabase(), collectionName, id);
  await deleteDoc(docRef);
};

export const subscribeToCollection = (
  collectionName: string,
  callback: (data: any[], metadata: SnapshotState) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(collection(getDatabase(), collectionName));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      callback(data, {
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      });
    },
    onError,
  );
};

export async function changeDoc(
  collectionName: string,
  id: string,
  change: (data: any) => any,
) {
  const db = getDatabase();
  const ref = doc(db, collectionName, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const updated = change(snapshot.exists() ? snapshot.data() : null);
    transaction.set(ref, updated);
  });
}

export async function importDocs(data: Record<string, any[]>) {
  const db = getDatabase();
  const entries = Object.entries(data).flatMap(([key, rows]) =>
    rows.map((row) => ({ key, row })),
  );
  let completed = 0;
  try {
    for (let start = 0; start < entries.length; start += 200) {
      const batch = writeBatch(db);
      let size = 0;
      let count = 0;
      for (const { key, row } of entries.slice(start, start + 200)) {
        const bytes = new TextEncoder().encode(JSON.stringify(row)).length;
        if (count && size + bytes > 7 * 1024 * 1024) break;
        batch.set(doc(db, key, row.id), row);
        size += bytes;
        count++;
      }
      await batch.commit();
      completed += count;
      start -= 200 - count;
    }
  } catch {
    throw new Error(
      `导入中断，已完成 ${completed} / ${entries.length} 条。可重新导入同一备份继续，同编号记录不会重复。`,
    );
  }
}
