import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0812096423",
  appId: "1:397125428761:web:189b42a558d95ecb04ac88",
  apiKey: "AIzaSyDYmxxAHH44HeQYxiUxnO0rRVTLFW00YeA",
  authDomain: "gen-lang-client-0812096423.firebaseapp.com",
  storageBucket: "gen-lang-client-0812096423.firebasestorage.app",
  messagingSenderId: "397125428761"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-swissgridmeeting-a16ddb46-1d3b-4bec-b582-68e11ee0149e");

// Helper functions for CRUD
export const saveDoc = async (collectionName: string, data: any) => {
  const docRef = doc(db, collectionName, data.id);
  await setDoc(docRef, data);
};

export const removeDoc = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
  const q = query(collection(db, collectionName));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => doc.data());
    callback(data);
  });
};
