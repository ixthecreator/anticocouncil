import { useEffect, useRef, useState } from "react";
import type { WorkspaceData } from "../types";
import {
  collectionNames,
  CollectionName,
  emptyWorkspace,
  parseBackup,
} from "./workspace";
import {
  changeDoc,
  importDocs,
  removeDoc,
  saveDoc,
  subscribeToCollection,
} from "./firebase";

const STORAGE_KEY = "antico_workspace_v2";
export function readLocal(): WorkspaceData {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored)
    return { ...emptyWorkspace(), ...parseBackup(JSON.parse(stored)) };
  const legacy = Object.fromEntries(
    collectionNames.map((key) => [
      key,
      JSON.parse(localStorage.getItem(`local_${key}`) || "[]"),
    ]),
  );
  return { ...emptyWorkspace(), ...parseBackup(legacy) };
}
export function useWorkspace() {
  const [mode, setMode] = useState<"local" | "firebase">(() =>
    localStorage.getItem("storage_mode") === "firebase" ? "firebase" : "local",
  );
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(0);
  const busy = useRef(0);
  const readable = useRef(false);
  useEffect(() => {
    localStorage.setItem("storage_mode", mode);
    setData(emptyWorkspace());
    setReady(false);
    readable.current = false;
    setError("");
    setNotice("");
    if (mode === "local") {
      const read = () => {
        try {
          setData(readLocal());
          setReady(true);
          readable.current = true;
        } catch {
          setError(
            "本地备份无法读取，原始数据仍保留。请先导出原始数据，再检查备份。",
          );
        }
      };
      read();
      const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) read();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    let active = true;
    const loaded = new Set<string>();
    const subscriptions = collectionNames.map((key) =>
      subscribeToCollection(
        key,
        (rows) => {
          if (!active) return;
          try {
            parseBackup({ [key]: rows });
            setData((previous) => ({ ...previous, [key]: rows }));
            loaded.add(key);
            if (loaded.size === collectionNames.length) {
              setReady(true);
              readable.current = true;
            }
          } catch (err) {
            setError(
              `云端 ${key} 数据格式不兼容：${err instanceof Error ? err.message : "请检查数据"}`,
            );
          }
        },
        () => {
          if (active) {
            setReady(false);
            readable.current = false;
            setError(
              "云端连接失败，请检查网络或数据库权限。可切换到本地工作区继续。",
            );
          }
        },
      ),
    );
    const timeout = setTimeout(() => {
      if (active && loaded.size < collectionNames.length)
        setError("云端尚未连接完成。请检查网络，或切换到本地工作区。");
    }, 12000);
    return () => {
      active = false;
      clearTimeout(timeout);
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [mode]);
  const run = async (
    operation: () => Promise<void> | void,
    allowRecovery = false,
  ) => {
    if (!readable.current && !allowRecovery) {
      setError("工作区尚未加载完成，暂不能修改数据。");
      throw new Error("工作区尚未加载完成");
    }
    busy.current++;
    setPending(busy.current);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice("已保存");
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败，请重试。";
      setError(message);
      throw err;
    } finally {
      busy.current--;
      setPending(busy.current);
    }
  };
  const commitLocal = (next: WorkspaceData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setData(next);
  };
  const save = <K extends CollectionName>(
    key: K,
    row: WorkspaceData[K][number],
  ) =>
    run(async () => {
      if (mode === "firebase") return saveDoc(key, row);
      const latest = readLocal();
      const rows = latest[key] as { id: string }[];
      const index = rows.findIndex((item) => item.id === row.id);
      if (index < 0) rows.push(row);
      else rows[index] = { ...rows[index], ...row };
      commitLocal(latest);
    });
  const remove = (key: CollectionName, id: string) =>
    run(async () => {
      if (mode === "firebase") return removeDoc(key, id);
      const latest = readLocal();
      (latest as any)[key] = latest[key].filter((row) => row.id !== id);
      commitLocal(latest);
    });
  const change = <K extends CollectionName>(
    key: K,
    id: string,
    fn: (record: WorkspaceData[K][number] | null) => WorkspaceData[K][number],
  ) =>
    run(async () => {
      if (mode === "firebase") return changeDoc(key, id, fn);
      const latest = readLocal();
      const rows = latest[key] as { id: string }[];
      const index = rows.findIndex((row) => row.id === id);
      const next = fn(index < 0 ? null : (rows[index] as any));
      if (index < 0) rows.push(next);
      else rows[index] = next;
      commitLocal(latest);
    });
  const importBackup = (input: unknown) =>
    run(async () => {
      const parsed = parseBackup(input);
      if (mode === "firebase") return importDocs(parsed);
      let next: WorkspaceData;
      if (!readable.current) {
        const raw = localStorage.getItem(STORAGE_KEY);
        localStorage.setItem(
          `${STORAGE_KEY}_recovery`,
          JSON.stringify({
            raw,
            legacy: Object.fromEntries(
              collectionNames.map((key) => [
                key,
                localStorage.getItem(`local_${key}`),
              ]),
            ),
          }),
        );
        next = emptyWorkspace();
      } else next = readLocal();
      for (const key of collectionNames)
        if (parsed[key]) {
          const rows = new Map<string, { id: string }>(
            next[key].map((row) => [row.id, row] as const),
          );
          for (const row of parsed[key]!) rows.set(row.id, row as any);
          (next as any)[key] = [...rows.values()];
        }
      commitLocal(next);
      setReady(true);
      readable.current = true;
    }, mode === "local");
  const switchMode = (next: "local" | "firebase") => {
    if (!busy.current) setMode(next);
  };
  const rawLocalBackup = () =>
    JSON.stringify(
      {
        raw: localStorage.getItem(STORAGE_KEY),
        legacy: Object.fromEntries(
          collectionNames.map((key) => [
            key,
            localStorage.getItem(`local_${key}`),
          ]),
        ),
      },
      null,
      2,
    );
  return {
    data,
    mode,
    switchMode,
    ready,
    pending,
    error,
    notice,
    setError,
    save,
    remove,
    change,
    importBackup,
    rawLocalBackup,
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;
