import type { VotingRecord, VotingStore, VotingTransaction } from "./votingService";

/** Isolated test store with optimistic retries and atomic rollback; never connects to Firebase. */
export class VotingTestStore implements VotingStore {
  private records = new Map<string, VotingRecord>();
  private revision = 0;
  retries = 0;

  seed(path: string, data: VotingRecord) {
    this.records.set(path, structuredClone(data));
    this.revision++;
  }

  read(path: string) {
    return structuredClone(this.records.get(path) ?? null);
  }

  paths() { return [...this.records.keys()].sort(); }

  async runTransaction<T>(operation: (transaction: VotingTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const revision = this.revision;
      const snapshot = new Map([...this.records].map(([key, data]) => [key, structuredClone(data)]));
      let writing = false;
      const readOnly = () => { if (writing) throw new Error("Firestore transactions must read before writing"); };
      const result = await operation({
        get: async (path) => { readOnly(); return structuredClone(snapshot.get(path) ?? null); },
        hasMatchingDocument: async (collection, field, value) => {
          readOnly();
          return [...snapshot].some(([path, data]) => path.startsWith(`${collection}/`) &&
            path.split("/").length === 2 && data[field] === value);
        },
        create: (path, data) => {
          writing = true;
          if (snapshot.has(path)) throw new Error("Document already exists");
          snapshot.set(path, structuredClone(data));
        },
        update: (path, patch, deleteFields = []) => {
          writing = true;
          const existing = snapshot.get(path);
          if (!existing) throw new Error("Document does not exist");
          const updated = { ...existing, ...structuredClone(patch) };
          for (const field of deleteFields) delete updated[field];
          snapshot.set(path, updated);
        },
        delete: (path) => { writing = true; snapshot.delete(path); },
      });
      if (revision !== this.revision) { this.retries++; continue; }
      if (writing) { this.records = snapshot; this.revision++; }
      return result;
    }
    throw new Error("Test transaction exceeded retry budget");
  }
}
