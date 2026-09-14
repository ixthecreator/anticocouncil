import { useEffect, useMemo, useRef, useState } from "react";
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
  firebaseConfiguration,
  firebaseErrorMessage,
  getCloudWriteIdentity,
} from "./firebase";
import {
  WORKSPACE_STORAGE_KEY, createWriteSession, mutateLocalWorkspace, rawLocalWorkspace,
  readLocalWorkspace, requireLocalMeeting, validateRecord, validateRecordId,
  type WriteGuard,
} from "./workspacePersistence";
import {
  newCollectionConnection,
  receiveCollectionSnapshot,
  summarizeCloudConnection,
  type WorkspaceConnection,
} from "./firebaseConnection";

const STORAGE_KEY = WORKSPACE_STORAGE_KEY;
export const readLocal = (): WorkspaceData => readLocalWorkspace(localStorage);
export function useWorkspace(control?: {
  mode: "local" | "firebase";
  onModeChange: (mode: "local" | "firebase") => void;
}) {
  const [localMode, setLocalMode] = useState<"local" | "firebase">(() => {
    try { return localStorage.getItem("storage_mode") === "firebase" ? "firebase" : "local"; }
    catch { return "local"; }
  });
  const mode = control?.mode ?? localMode;
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [connection, setConnection] = useState<WorkspaceConnection>(mode === "local" ? "local" : "connecting");
  const [connectionError, setConnectionError] = useState("");
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const session = useMemo(() => createWriteSession(mode === "firebase"
    ? () => firebaseConfiguration.error ? null : getCloudWriteIdentity()
    : undefined), [mode, reconnectVersion]);
  const [pending, setPending] = useState(0);
  const busy = useRef(0);
  const mounted = useRef(false);
  const readable = useRef(false);
  const previousMode = useRef(mode);
  const waitingWrites = useRef(new Set<symbol>());
  useEffect(() => {
    mounted.current = true;
    session.activate();
    try { localStorage.setItem("storage_mode", mode); }
    catch { setError("浏览器无法保存工作区设置。请检查存储权限并保留数据备份。"); }
    if (previousMode.current !== mode) {
      previousMode.current = mode;
      setData(emptyWorkspace());
      setDataLoaded(false);
      setError("");
      setNotice("");
    }
    setReady(false);
    readable.current = false;
    setConnectionError("");
    if (mode === "local") {
      setConnection("local");
      const read = () => {
        try {
          setData(readLocal());
          setReady(true);
          setDataLoaded(true);
          readable.current = true;
        } catch {
          setReady(false);
          readable.current = false;
          setError(
            "本地备份无法读取，原始数据仍保留。请先导出原始数据，再检查备份。",
          );
        }
      };
      read();
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === STORAGE_KEY || event.key.startsWith("local_")) read();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        mounted.current = false;
        session.deactivate();
        readable.current = false;
        window.removeEventListener("storage", onStorage);
      };
    }
    setConnection("connecting");
    if (firebaseConfiguration.error) {
      setConnection("error");
      setConnectionError(firebaseConfiguration.error);
      return () => { mounted.current = false; session.deactivate(); readable.current = false; };
    }
    let active = true;
    const loaded = new Set<string>();
    const statuses = Object.fromEntries(collectionNames.map((key) => [key, newCollectionConnection()]));
    let browserOffline = !navigator.onLine;
    let timedOut = false;
    const publishStatus = () => {
      if (!active) return;
      const summary = summarizeCloudConnection(Object.values(statuses), browserOffline, timedOut);
      setConnection(summary.connection);
      setConnectionError(summary.error);
      setReady(summary.ready);
      readable.current = summary.ready;
      if (loaded.size === collectionNames.length) setDataLoaded(true);
    };
    const subscriptions: (() => void)[] = [];
    for (const key of collectionNames) {
      const fail = (message: string) => {
        if (!active) return;
        statuses[key] = { ...statuses[key], error: message };
        publishStatus();
      };
      try {
        subscriptions.push(subscribeToCollection(
          key,
          (rows, metadata) => {
            if (!active) return;
            try {
              parseBackup({ [key]: rows });
              setData((previous) => ({ ...previous, [key]: rows }));
              loaded.add(key);
              statuses[key] = receiveCollectionSnapshot(statuses[key], metadata);
              publishStatus();
            } catch (err) {
              fail(`云端 ${key} 数据格式不兼容：${err instanceof Error ? err.message : "请检查数据"}`);
            }
          },
          (err) => fail(`云端 ${key}：${firebaseErrorMessage(err)}`),
        ));
      } catch (err) {
        fail(firebaseErrorMessage(err));
      }
    }
    publishStatus();
    const timeout = setTimeout(() => {
      timedOut = true;
      publishStatus();
    }, 12000);
    const onOffline = () => { browserOffline = true; publishStatus(); };
    const onOnline = () => { if (active) setReconnectVersion((version) => version + 1); };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      active = false;
      mounted.current = false;
      session.deactivate();
      readable.current = false;
      clearTimeout(timeout);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [mode, reconnectVersion, session]);
  const run = async (
    operation: (assertCurrent: WriteGuard) => Promise<void> | void,
    allowRecovery = false,
  ) => {
    const assertCurrent = session.capture();
    const isCurrent = () => { try { assertCurrent(); return true; } catch { return false; } };
    if (!readable.current && !allowRecovery) {
      setError("工作区尚未加载完成，暂不能修改数据。");
      throw new Error("工作区尚未加载完成");
    }
    busy.current++;
    setPending(busy.current);
    setError("");
    setNotice("");
    const operationId = Symbol();
    const warningTimer = mode === "firebase" ? setTimeout(() => {
      if (!isCurrent()) return;
      waitingWrites.current.add(operationId);
      setNotice("写入仍在等待云端确认。请保持页面打开并恢复网络，不要重复提交；此时不能确认保存成功或失败。");
    }, 15000) : undefined;
    let saved = false;
    try {
      await operation(assertCurrent);
      assertCurrent();
      saved = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败，请重试。";
      if (isCurrent()) setError(message);
      throw err;
    } finally {
      if (warningTimer !== undefined) clearTimeout(warningTimer);
      waitingWrites.current.delete(operationId);
      busy.current--;
      // Reconnecting replaces the session but keeps this mounted hook and its
      // pending counter. An old operation must still release that shared count.
      if (mounted.current) setPending(busy.current);
      if (!isCurrent()) { /* The new workspace owns its own feedback. */ }
      else if (waitingWrites.current.size) {
        setNotice("写入仍在等待云端确认。请保持页面打开并恢复网络，不要重复提交；此时不能确认保存成功或失败。");
      } else if (!busy.current) setNotice(saved
        ? mode === "local" && !globalThis.navigator?.locks
          ? "已保存。此浏览器不支持多标签写入锁，请只在一个标签页编辑本地数据。"
          : "已保存"
        : "");
    }
  };
  const writeLocal = async (transform: (latest: WorkspaceData) => WorkspaceData, assertCurrent: WriteGuard, recover = false) => {
    const next = await mutateLocalWorkspace(transform, {
      store: localStorage, assertCurrent, recover, locks: globalThis.navigator?.locks,
    });
    assertCurrent();
    setData(next);
  };
  const localMutation = (transform: (latest: WorkspaceData) => WorkspaceData) => run(async assertCurrent => {
    if (mode !== "local") throw new Error("此操作仅用于本地工作区。");
    await writeLocal(transform, assertCurrent);
  });
  const save = <K extends CollectionName>(
    key: K,
    row: WorkspaceData[K][number],
  ) =>
    run(async (assertCurrent) => {
      validateRecord(key, row);
      if (mode === "firebase") return saveDoc(key, row, assertCurrent);
      await writeLocal(latest => {
        const rows = latest[key] as { id: string }[];
        const index = rows.findIndex((item) => item.id === row.id);
        requireLocalMeeting(key, row, latest, index < 0 ? null : latest[key][index]);
        if (index < 0) rows.push(row);
        else rows[index] = { ...rows[index], ...row };
        return latest;
      }, assertCurrent);
    });
  const remove = (key: CollectionName, id: string) =>
    run(async (assertCurrent) => {
      validateRecordId(id);
      if (mode === "firebase") return removeDoc(key, id, assertCurrent);
      await writeLocal(latest => {
        (latest as any)[key] = latest[key].filter((row) => row.id !== id);
        return latest;
      }, assertCurrent);
    });
  const change = <K extends CollectionName>(
    key: K,
    id: string,
    fn: (record: WorkspaceData[K][number] | null) => WorkspaceData[K][number],
  ) =>
    run(async (assertCurrent) => {
      validateRecordId(id);
      if (mode === "firebase") return changeDoc(key, id, fn, assertCurrent);
      await writeLocal(latest => {
        const rows = latest[key] as { id: string }[];
        const index = rows.findIndex((row) => row.id === id);
        const next = validateRecord(key, fn(index < 0 ? null : (rows[index] as any)), id);
        requireLocalMeeting(key, next, latest, index < 0 ? null : latest[key][index]);
        if (index < 0) rows.push(next);
        else rows[index] = next;
        return latest;
      }, assertCurrent);
    });
  const importBackup = (input: unknown) =>
    run(async (assertCurrent) => {
      const parsed = parseBackup(input);
      if (mode === "firebase") return importDocs(parsed, assertCurrent);
      await writeLocal(next => {
        const previousIssues = new Map(next.issues.map(row => [row.id, row]));
        const previousAttendance = new Map(next.attendance.map(row => [row.id, row]));
        for (const key of collectionNames)
          if (parsed[key]) {
            const rows = new Map<string, { id: string }>(next[key].map((row) => [row.id, row] as const));
            for (const row of parsed[key]!) rows.set(row.id, row as any);
            (next as any)[key] = [...rows.values()];
          }
        for (const key of ["issues", "attendance"] as const)
          for (const row of parsed[key] || []) requireLocalMeeting(key, row, next,
            key === "issues" ? previousIssues.get(row.id) : previousAttendance.get(row.id));
        return next;
      }, assertCurrent, true);
      setReady(true);
      setDataLoaded(true);
      readable.current = true;
    }, mode === "local");
  const switchMode = (next: "local" | "firebase") => {
    if (!busy.current && next !== mode) {
      readable.current = false;
      session.deactivate();
      setReady(false);
      if (control) control.onModeChange(next);
      else setLocalMode(next);
    }
  };
  const reconnect = () => {
    if (mode !== "firebase") return;
    readable.current = false;
    session.deactivate();
    setReady(false);
    setConnection("connecting");
    setConnectionError("");
    setReconnectVersion((version) => version + 1);
  };
  const rawLocalBackup = () =>
    JSON.stringify(
      rawLocalWorkspace(localStorage),
      null,
      2,
    );
  return {
    data,
    mode,
    switchMode,
    ready,
    dataLoaded,
    connection,
    connectionError,
    reconnect,
    pending,
    error,
    notice,
    setError,
    save,
    remove,
    change,
    importBackup,
    rawLocalBackup,
    runOperation: run,
    localMutation,
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;
