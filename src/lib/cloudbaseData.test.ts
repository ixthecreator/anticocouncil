import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as cloudbaseApp from "./cloudbaseApp";
import { changeRecord, cloudbaseErrorMessage, importRecords, removeRecord, saveRecord, subscribeToCollection } from "./cloudbaseData";

afterEach(() => mock.restore());

type Row = Record<string, any>;
const SET = "$set", REMOVE = "$remove", EXISTS = "$exists";
const command = (key: string, value: unknown) => ({ [key]: value });
const isCommand = (value: unknown, key: string) => !!value && typeof value === "object" && key in value;

// An in-memory stand-in for the CloudBase database, enough for the calls the site makes.
function fakeDatabase() {
  const tables = new Map<string, Map<string, Row>>();
  const table = (name: string) => tables.get(name) || tables.set(name, new Map()).get(name)!;
  const watchers: Row[] = [];
  const hooks = { beforeUpdate: (_name: string) => {}, failSet: "" };
  const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) =>
    isCommand(value, EXISTS) ? (key in row) === value[EXISTS] : row[key] === value);
  const query = (name: string, where?: Row) => ({
    watch(options: Row) {
      const watcher = { name, where, ...options, close: mock(() => {}) };
      watchers.push(watcher);
      return { close: watcher.close };
    },
    async update(data: Row) {
      hooks.beforeUpdate(name);
      let updated = 0;
      for (const [id, row] of table(name)) {
        if (where && !matches({ _id: id, ...row }, where)) continue;
        const next = { ...row };
        for (const [key, value] of Object.entries(data)) {
          if (isCommand(value, REMOVE)) delete next[key];
          else next[key] = isCommand(value, SET) ? value[SET] : value;
        }
        table(name).set(id, next);
        updated++;
      }
      return { updated };
    },
  });
  const db = {
    command: { set: (value: unknown) => command(SET, value), remove: () => command(REMOVE, true), exists: (value: boolean) => command(EXISTS, value) },
    collection: (name: string) => ({
      ...query(name),
      where: (where: Row) => query(name, where),
      doc: (id: string) => ({
        get: async () => ({ data: table(name).has(id) ? [{ _id: id, ...table(name).get(id) }] : [] }),
        set: async (data: Row) => {
          if (hooks.failSet && id === hooks.failSet) return { code: "DATABASE_REQUEST_FAILED", message: "request failed" };
          table(name).set(id, { ...data });
          return {};
        },
        remove: async () => { table(name).delete(id); return {}; },
      }),
      add: async ({ _id, ...data }: Row) => {
        if (table(name).has(_id)) return { code: "DATABASE_DUPLICATE_WRITE", message: "duplicate key" };
        table(name).set(_id, data);
        return {};
      },
    }),
  };
  spyOn(cloudbaseApp, "getCloudbaseApp").mockResolvedValue({ database: () => db } as never);
  return { table, watchers, hooks };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test("a watched collection reports rows by id, without service fields, until it is closed", async () => {
  const { watchers } = fakeDatabase();
  const rows = mock();
  const errors = mock();
  const stop = subscribeToCollection("meetings", rows, errors);
  await settle();
  expect(watchers).toHaveLength(1);
  watchers[0].onChange({ docs: [{ _id: "m1", _openid: "x", syncRevision: "r1", title: "例会" }] });
  expect(rows).toHaveBeenCalledWith([{ id: "m1", title: "例会" }], { fromCache: false, hasPendingWrites: false });
  watchers[0].onError({ errCode: "DATABASE_PERMISSION_DENIED", errMsg: "permission denied" });
  expect(errors.mock.calls[0][0].message).toBe("当前账号没有此工作区的读取权限，请联系项目管理员确认成员授权。");
  stop();
  expect(watchers[0].close).toHaveBeenCalledTimes(1);
  watchers[0].onChange({ docs: [] });
  expect(rows).toHaveBeenCalledTimes(1);
});

test("a watch can be narrowed to an account's own records", async () => {
  const { watchers } = fakeDatabase();
  subscribeToCollection("workspaceAccess", mock(), mock(), { uid: "alice" });
  await settle();
  expect(watchers[0].where).toEqual({ uid: "alice" });
});

test("a watch closed before the service loads never starts", async () => {
  const { watchers } = fakeDatabase();
  subscribeToCollection("meetings", mock(), mock())();
  await settle();
  expect(watchers).toHaveLength(0);
});

test("saving replaces the record, stamps a revision and never stores named ballots", async () => {
  const { table } = fakeDatabase();
  await saveRecord("issues", { id: "i1", title: "预算", voteMode: "members", ballots: { a: "approve", b: "reject" }, note: undefined });
  const stored = table("issues").get("i1")!;
  expect(stored.ballots).toBeUndefined();
  expect(stored).toMatchObject({ id: "i1", title: "预算", voteMode: "manual", votes: { approve: 1, reject: 1, abstain: 0 } });
  expect("note" in stored).toBe(false);
  expect(typeof stored.syncRevision).toBe("string");
  await removeRecord("issues", "i1");
  expect(table("issues").has("i1")).toBe(false);
});

test("a change creates a missing record under its own id", async () => {
  const { table } = fakeDatabase();
  await changeRecord("meetings", "m1", current => ({ ...(current || { id: "m1" }), title: "新例会" }));
  expect(table("meetings").get("m1")).toMatchObject({ id: "m1", title: "新例会" });
});

test("a change replaces nested values whole and removes dropped fields", async () => {
  const { table } = fakeDatabase();
  table("meetings").set("m1", { id: "m1", title: "例会", agenda: { a: 1, b: 2 }, draft: "临时", syncRevision: "r1" });
  await changeRecord("meetings", "m1", ({ draft: _draft, ...current }) => ({ ...current, agenda: { a: 3 } }));
  const stored = table("meetings").get("m1")!;
  expect(stored.agenda).toEqual({ a: 3 });
  expect("draft" in stored).toBe(false);
  expect(stored.syncRevision).not.toBe("r1");
});

test("a concurrent edit is reapplied to the newer record instead of being overwritten", async () => {
  const { table, hooks } = fakeDatabase();
  table("attendance").set("a1", { id: "a1", notes: ["甲"], syncRevision: "r1" });
  let raced = false;
  hooks.beforeUpdate = () => {
    if (raced) return;
    raced = true;
    // Another member's write lands between this read and this write.
    table("attendance").set("a1", { id: "a1", notes: ["甲", "乙"], syncRevision: "r2" });
  };
  const change = mock((current: Row) => ({ ...current, notes: [...current.notes, "丙"] }));
  await changeRecord("attendance", "a1", change);
  expect(change).toHaveBeenCalledTimes(2);
  expect(table("attendance").get("a1")!.notes).toEqual(["甲", "乙", "丙"]);
});

test("records imported without a revision can still be changed", async () => {
  const { table } = fakeDatabase();
  table("members").set("p1", { id: "p1", name: "甲" });
  await changeRecord("members", "p1", current => ({ ...current, name: "乙" }));
  expect(table("members").get("p1")).toMatchObject({ name: "乙" });
});

test("a record that keeps changing underneath gives up with a clear message", async () => {
  const { table, hooks } = fakeDatabase();
  table("members").set("p1", { id: "p1", name: "甲", syncRevision: "r0" });
  let round = 0;
  hooks.beforeUpdate = () => table("members").set("p1", { id: "p1", name: "甲", syncRevision: `r${++round}` });
  await expect(changeRecord("members", "p1", current => ({ ...current, name: "乙" }))).rejects.toThrow("记录正被其他成员同时修改，请稍后重试。");
  expect(round).toBe(5);
});

test("an interrupted import says how far it got and that it can be repeated", async () => {
  const { table, hooks } = fakeDatabase();
  const meetings = Array.from({ length: 7 }, (_, index) => ({ id: `m${index}`, title: `第 ${index} 次` }));
  hooks.failSet = "m6";
  await expect(importRecords({ meetings })).rejects.toThrow("导入中断，已完成 5 / 7 条。");
  hooks.failSet = "";
  await importRecords({ meetings });
  expect(table("meetings").size).toBe(7);
});

test("service errors become messages members can act on", () => {
  expect(cloudbaseErrorMessage({ code: "DATABASE_PERMISSION_DENIED" })).toContain("没有此工作区的读取权限");
  expect(cloudbaseErrorMessage({ code: "INVALID_ENV" })).toContain("环境编号");
  expect(cloudbaseErrorMessage({ code: "FUNCTIONS_NOT_EXIST" })).toContain("成员服务尚未部署");
  expect(cloudbaseErrorMessage({ code: "SOMETHING_NEW" })).toBe("云端操作失败（SOMETHING_NEW），请稍后重试。");
  expect(cloudbaseErrorMessage(new Error("已经是中文的说明"))).toBe("已经是中文的说明");
  expect(cloudbaseErrorMessage(null)).toBe("云端连接失败，请检查网络和项目配置后重试。");
});
