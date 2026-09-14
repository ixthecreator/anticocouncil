import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as React from "react";
import { useWorkspace } from "./useWorkspace";
import { emptyWorkspace } from "./workspace";
import { WORKSPACE_STORAGE_KEY } from "./workspacePersistence";

const originalGlobals = new Map(["window", "localStorage", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
afterEach(() => {
  mock.restore();
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
function workspace(initial = JSON.stringify(emptyWorkspace())) {
  const effects: React.EffectCallback[] = [];
  const changes: unknown[] = [];
  const values = new Map([[WORKSPACE_STORAGE_KEY, initial]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  spyOn(React, "useState").mockImplementation(((value: unknown) => [typeof value === "function" ? value() : value, (next: unknown) => { changes.push(next); }]) as unknown as typeof React.useState);
  spyOn(React, "useRef").mockImplementation(((value: unknown) => ({ current: value })) as typeof React.useRef);
  spyOn(React, "useMemo").mockImplementation(fn => fn());
  spyOn(React, "useEffect").mockImplementation(effect => { effects.push(effect); });
  const onModeChange = mock(() => {});
  const result = useWorkspace({ mode: "local", onModeChange });
  return { result, values, changes, onModeChange, mount: () => effects[0]() as () => void };
}

test("the hook refuses an import resolving after unmount even when local recovery is allowed", async () => {
  const view = workspace("damaged data");
  await expect(view.result.importBackup({ inventory: [] })).rejects.toThrow("工作区已关闭");
  const cleanup = view.mount();
  let finish!: (data: unknown) => void;
  const pendingFile = new Promise(resolve => { finish = resolve; });
  const importAfterRead = pendingFile.then(data => view.result.importBackup(data));
  cleanup();
  finish({ inventory: [] });
  await expect(importAfterRead).rejects.toThrow("工作区已关闭");
  expect(view.values.get(WORKSPACE_STORAGE_KEY)).toBe("damaged data");
  expect(view.values.has(`${WORKSPACE_STORAGE_KEY}_recovery`)).toBe(false);
});

test("save and custom local mutations share validation and leave storage intact on rejection", async () => {
  const view = workspace();
  const cleanup = view.mount();
  const original = view.values.get(WORKSPACE_STORAGE_KEY);
  const invalid = { id: "i", title: "纸张", quantity: Number.MAX_SAFE_INTEGER + 1, location: "", keeper: "", notes: "" };
  await expect(view.result.save("inventory", invalid)).rejects.toThrow("非负整数");
  await expect(view.result.localMutation(latest => ({ ...latest, inventory: [invalid] }))).rejects.toThrow("非负整数");
  expect(view.values.get(WORKSPACE_STORAGE_KEY)).toBe(original);
  await view.result.localMutation(latest => ({ ...latest, inventory: [{ ...invalid, quantity: 3 }] }));
  expect(JSON.parse(view.values.get(WORKSPACE_STORAGE_KEY)!).inventory[0].quantity).toBe(3);
  expect(view.changes).toContain("已保存。此浏览器不支持多标签写入锁，请只在一个标签页编辑本地数据。");
  cleanup();
});

test("external API operations share the pending guard and release it after settlement", async () => {
  const view = workspace();
  const cleanup = view.mount();
  let finish!: () => void;
  const work = new Promise<void>(resolve => { finish = resolve; });
  const operation = view.result.runOperation(async assertCurrent => { await work; assertCurrent(); });
  view.result.switchMode("firebase");
  expect(view.onModeChange).not.toHaveBeenCalled();
  finish();
  await operation;
  view.result.switchMode("firebase");
  expect(view.onModeChange).toHaveBeenCalledTimes(1);
  await expect(view.result.localMutation(latest => latest)).rejects.toThrow("工作区已关闭");
  cleanup();
});

test("an invalidated operation releases pending state after the workspace effect reconnects", async () => {
  const view = workspace();
  const firstCleanup = view.mount();
  let finish!: () => void;
  const work = new Promise<void>(resolve => { finish = resolve; });
  const operation = view.result.runOperation(async () => { await work; });
  firstCleanup();
  const cleanup = view.mount();
  finish();
  await expect(operation).rejects.toThrow("工作区已关闭");
  expect(view.changes.at(-1)).toBe(0);
  cleanup();
});
