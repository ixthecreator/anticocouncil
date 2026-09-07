import { initializeApp } from "firebase/app";
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

const firebaseConfig = {
  projectId: "gen-lang-client-0812096423",
  appId: "1:397125428761:web:189b42a558d95ecb04ac88",
  apiKey: "AIzaSyDYmxxAHH44HeQYxiUxnO0rRVTLFW00YeA",
  authDomain: "gen-lang-client-0812096423.firebaseapp.com",
  storageBucket: "gen-lang-client-0812096423.firebasestorage.app",
  messagingSenderId: "397125428761",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(
  app,
  "ai-studio-swissgridmeeting-a16ddb46-1d3b-4bec-b582-68e11ee0149e",
);

// Helper functions for CRUD
export const saveDoc = async (collectionName: string, data: any) => {
  const docRef = doc(db, collectionName, data.id);
  await setDoc(docRef, data, { merge: true });
};

export const removeDoc = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};

export const subscribeToCollection = (
  collectionName: string,
  callback: (data: any[]) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(collection(db, collectionName));
  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      callback(data);
    },
    onError,
  );
};

export async function changeDoc(
  collectionName: string,
  id: string,
  change: (data: any) => any,
) {
  const ref = doc(db, collectionName, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const updated = change(snapshot.exists() ? snapshot.data() : null);
    transaction.set(ref, updated);
  });
}

export async function importDocs(data: Record<string, any[]>) {
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
