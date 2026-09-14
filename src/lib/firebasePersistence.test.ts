import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as sdk from "firebase/firestore";
import * as persistence from "./firebase";
import { createWriteSession } from "./workspacePersistence";

afterEach(() => mock.restore());
const item = { id: "i", title: "纸张", quantity: 10, location: "资料室", keeper: "张三", notes: "" };
const agenda = { id: "issue", title: "原议题", category: "其他", priority: "medium" as const, status: "agenda" as const, description: "原命题", discussion: "", signature: "", createdAt: "2026-09-01", updatedAt: "2026-09-01", archived: false, meetingId: null };
const current = () => {};
function database() {
  spyOn(persistence, "getDatabase").mockReturnValue({} as sdk.Firestore);
  spyOn(sdk, "doc").mockImplementation(((_db: unknown, key: string, id: string) => ({ id, path: `${key}/${id}` })) as typeof sdk.doc);
}

test("a malformed last import row is rejected before the first cloud batch is created", async () => {
  database();
  const batch = spyOn(sdk, "writeBatch");
  const rows = Array.from({ length: 201 }, (_, index) => ({ ...item, id: `i-${index}` }));
  rows[200].quantity = Number.MAX_SAFE_INTEGER + 1;
  await expect(persistence.importDocs({ inventory: rows }, current)).rejects.toThrow("非负整数");
  expect(batch).not.toHaveBeenCalled();
  rows[200].quantity = 1;
  rows[200].notes = "中".repeat(400000);
  await expect(persistence.importDocs({ inventory: rows }, current)).rejects.toThrow("单条记录过大");
  expect(batch).not.toHaveBeenCalled();
});

test("switching accounts after one import batch stops all subsequent batches and reports confirmed progress", async () => {
  database();
  let uid = "account-a";
  const session = createWriteSession(() => uid);
  session.activate();
  const writes: string[] = [];
  const commit = mock(async () => { uid = "account-b"; });
  const batches = spyOn(sdk, "writeBatch").mockImplementation(() => ({
    set: (ref: sdk.DocumentReference) => { writes.push(ref.path); }, commit,
  }) as unknown as sdk.WriteBatch);
  const rows = Array.from({ length: 201 }, (_, index) => ({ ...item, id: `i-${index}` }));
  await expect(persistence.importDocs({ inventory: rows }, session.capture())).rejects.toThrow("已确认完成 200 / 201 条。登录账号已改变");
  expect(commit).toHaveBeenCalledTimes(1);
  expect(batches).toHaveBeenCalledTimes(1);
  expect(writes).toHaveLength(200);
});

test("an import with a missing external meeting fails before changing any cloud record", async () => {
  database();
  const batch = spyOn(sdk, "writeBatch");
  spyOn(sdk, "getDoc").mockResolvedValue({ exists: () => false } as never);
  const attendance = { id: "a", meetingId: "missing", memberId: "m", memberName: "成员", checkedInAt: "", reportStatus: "pending" as const, reportNote: "" };
  await expect(persistence.importDocs({ inventory: [item], attendance: [attendance] }, current)).rejects.toThrow("关联会议缺失");
  expect(batch).not.toHaveBeenCalled();
});

test("transactions cannot change a record ID or write invalid field values", async () => {
  database();
  const set = mock(() => {});
  const transaction = { get: async () => ({ exists: () => true, data: () => item }), set } as unknown as sdk.Transaction;
  spyOn(sdk, "runTransaction").mockImplementation(async (_db, update) => update(transaction));
  await expect(persistence.changeDoc("inventory", item.id, old => ({ ...old, id: "different" }), current)).rejects.toThrow("文档路径不一致");
  await expect(persistence.changeDoc("inventory", item.id, old => ({ ...old, quantity: -1 }), current)).rejects.toThrow("非负整数");
  expect(set).not.toHaveBeenCalled();
});

test("a transaction stops if the account changes while its document read is pending", async () => {
  database();
  let uid = "a";
  const session = createWriteSession(() => uid);
  session.activate();
  const set = mock(() => {});
  const transaction = { get: async () => { uid = "b"; return { exists: () => true, data: () => item }; }, set } as unknown as sdk.Transaction;
  spyOn(sdk, "runTransaction").mockImplementation(async (_db, update) => update(transaction));
  const change = mock(old => ({ ...old, notes: "late edit" }));
  await expect(persistence.changeDoc("inventory", item.id, change, session.capture())).rejects.toThrow("登录账号已改变");
  expect(change).not.toHaveBeenCalled();
  expect(set).not.toHaveBeenCalled();
});

test("linked writes read the meeting inside the same transaction and reject a deleted parent", async () => {
  database();
  const reads: string[] = [];
  const set = mock(() => {});
  const transaction = { get: async (ref: sdk.DocumentReference) => { reads.push(ref.path); return { exists: () => false }; }, set } as unknown as sdk.Transaction;
  spyOn(sdk, "runTransaction").mockImplementation(async (_db, update) => update(transaction));
  const attendance = { id: "a", meetingId: "deleted", memberId: "m", memberName: "成员", checkedInAt: "", reportStatus: "pending" as const, reportNote: "" };
  await expect(persistence.changeDoc("attendance", "a", () => attendance, current)).rejects.toThrow("关联会议不存在");
  expect(reads).toEqual(["attendance/a", "meetings/deleted"]);
  expect(set).not.toHaveBeenCalled();
});

test("existing orphan records can be repaired without creating or moving another orphan", async () => {
  database();
  const attendance = { id: "a", meetingId: "deleted", memberId: "m", memberName: "成员", checkedInAt: "", reportStatus: "pending" as const, reportNote: "" };
  const reads: string[] = [];
  const set = mock(() => {});
  const transaction = { get: async (ref: sdk.DocumentReference) => {
    reads.push(ref.path);
    return { exists: () => ref.path === "attendance/a", data: () => attendance };
  }, set } as unknown as sdk.Transaction;
  spyOn(sdk, "runTransaction").mockImplementation(async (_db, update) => update(transaction));
  await persistence.changeDoc("attendance", "a", old => ({ ...old, reportNote: "补记历史汇报" }), current);
  expect(reads).toEqual(["attendance/a"]);
  expect(set).toHaveBeenCalledTimes(1);
  await expect(persistence.changeDoc("attendance", "a", old => ({ ...old, meetingId: "another-missing-meeting" }), current)).rejects.toThrow("关联会议不存在");
  expect(set).toHaveBeenCalledTimes(1);
});

test("meeting imports preserve existing mirror IDs and initialize new mirrors without changing record IDs", async () => {
  database();
  const meeting = { id: "existing", title: "导入会议", date: "2026-09-10", week: "星期四", summary: "", issueIds: ["backup-mirror"], createdAt: "2026-09-10" };
  spyOn(sdk, "getDoc").mockImplementation(async ref => ({
    exists: () => ref.path === "meetings/existing",
    data: () => ({ ...meeting, issueIds: ["current-mirror"] }),
  }) as never);
  const writes: Array<{ path: string; row: unknown }> = [];
  const commit = mock(async () => {});
  const transaction = {
    get: async (ref: sdk.DocumentReference) => ({ exists: () => ref.path === "meetings/existing", data: () => ({ ...meeting, issueIds: ["current-mirror"] }) }),
    set: (ref: sdk.DocumentReference, row: unknown) => { writes.push({ path: ref.path, row }); },
  } as unknown as sdk.Transaction;
  spyOn(sdk, "runTransaction").mockImplementation(async (_db, update) => { const result = await update(transaction); await commit(); return result; });
  await persistence.importDocs({ meetings: [meeting, { ...meeting, id: "new" }], inventory: [item] }, current);
  expect(writes[0]).toEqual({ path: "meetings/existing", row: { ...meeting, issueIds: ["current-mirror"] } });
  expect(writes[1]).toEqual({ path: "meetings/new", row: { ...meeting, id: "new", issueIds: [] } });
  expect(writes[2]).toEqual({ path: "inventory/i", row: item });
  expect(meeting.issueIds).toEqual(["backup-mirror"]);
  expect(commit).toHaveBeenCalledTimes(1);
});

test("imports limit distinct parent meetings per batch while preserving every attendance row", async () => {
  database();
  spyOn(sdk, "getDoc").mockResolvedValue({ exists: () => true } as never);
  const groups: string[][] = [];
  spyOn(sdk, "writeBatch").mockImplementation(() => {
    const parents: string[] = [];
    groups.push(parents);
    return { set: (_ref: sdk.DocumentReference, row: { meetingId: string }) => { parents.push(row.meetingId); }, commit: async () => {} } as unknown as sdk.WriteBatch;
  });
  const attendance = Array.from({ length: 21 }, (_, index) => ({ id: `a-${index}`, meetingId: `meeting-${index}`, memberId: "m", memberName: "成员", checkedInAt: "", reportStatus: "pending" as const, reportNote: "" }));
  await persistence.importDocs({ attendance }, current);
  expect(groups.map(group => group.length)).toEqual([10, 10, 1]);
  expect(groups.flat()).toEqual(attendance.map(row => row.meetingId));
});

test("new private or historical issues reject the whole import before any batch or transaction writes", async () => {
  database();
  spyOn(sdk, "getDoc").mockResolvedValue({ exists: () => false } as never);
  const batch = spyOn(sdk, "writeBatch");
  const transaction = spyOn(sdk, "runTransaction");
  const privateIssue = { ...agenda, status: "voting" as const, voteMode: "private" as const, voteRoundId: "round" };
  await expect(persistence.importDocs({ issues: [privateIssue], inventory: [item] }, current)).rejects.toThrow("管理员专用恢复");
  await expect(persistence.importDocs({ issues: [{ ...agenda, status: "completed" }], inventory: [item] }, current)).rejects.toThrow("管理员专用恢复");
  expect(batch).not.toHaveBeenCalled();
  expect(transaction).not.toHaveBeenCalled();
});

test("a vote started between import preflight and commit keeps its new round and original proposition", async () => {
  database();
  spyOn(sdk, "getDoc").mockResolvedValue({ exists: () => true, data: () => agenda } as never);
  const started = { ...agenda, status: "voting" as const, voteMode: "private" as const, voteRoundId: "new-round", voteRule: "absolute" as const };
  const writes: unknown[] = [];
  const transaction = { get: async () => ({ exists: () => true, data: () => started }), set: (_ref: unknown, row: unknown) => { writes.push(row); } } as unknown as sdk.Transaction;
  spyOn(sdk, "runTransaction").mockImplementation(async (_db, update) => update(transaction));
  const imported = { ...agenda, title: "备份旧标题", description: "备份旧命题", discussion: "导入的执行补充", ballots: { "someone-else": "approve" as const } };
  await persistence.importDocs({ issues: [imported] }, current);
  expect(writes).toEqual([{ ...started, discussion: imported.discussion }]);
  expect(writes[0]).not.toHaveProperty("ballots");
  expect(writes[0]).not.toHaveProperty("votes");
});

test("a vote closed during import preserves the server's result, counts, and close timestamp", async () => {
  database();
  const started = { ...agenda, status: "voting" as const, voteMode: "private" as const, voteRoundId: "round", voteRule: "simple" as const };
  spyOn(sdk, "getDoc").mockResolvedValue({ exists: () => true, data: () => started } as never);
  const closed = { ...started, status: "passed" as const, votes: { approve: 2, reject: 1, abstain: 0 }, voteClosedAt: "2026-09-10T10:00:00Z" };
  const writes: unknown[] = [];
  const transaction = { get: async () => ({ exists: () => true, data: () => closed }), set: (_ref: unknown, row: unknown) => { writes.push(row); } } as unknown as sdk.Transaction;
  spyOn(sdk, "runTransaction").mockImplementation(async (_db, update) => update(transaction));
  await persistence.importDocs({ issues: [{ ...agenda, discussion: "补记" }] }, current);
  expect(writes).toEqual([{ ...closed, discussion: "补记" }]);
});

test("ordinary issue imports retain non-editable server metadata and ignore unknown backup fields", () => {
  const latest = { ...agenda, serverMetadata: { protected: true }, serialNumber: "original-number" };
  const imported = { ...agenda, serverMetadata: { protected: false }, unrecognized: "backup only", discussion: "补充记录" };
  expect(persistence.prepareImportedIssue(imported, latest)).toEqual({ ...latest, discussion: "补充记录" });
});

test("cloud snapshots cannot expose a record under an ID different from its real document path", () => {
  database();
  spyOn(sdk, "collection").mockReturnValue({} as sdk.CollectionReference);
  spyOn(sdk, "query").mockReturnValue({} as sdk.Query);
  let receive!: (snapshot: unknown) => void;
  spyOn(sdk, "onSnapshot").mockImplementation(((_query: unknown, _options: unknown, next: typeof receive) => { receive = next; return () => {}; }) as typeof sdk.onSnapshot);
  const next = mock(() => {});
  const error = mock(() => {});
  persistence.subscribeToCollection("inventory", next, error);
  receive({ docs: [{ id: "actual-path", data: () => item }], metadata: { fromCache: false, hasPendingWrites: false } });
  expect(next).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledTimes(1);
  expect((error.mock.calls[0] as unknown as [Error])[0].message).toContain("文档路径不一致");
  receive({ docs: [{ id: item.id, data: () => item }], metadata: { fromCache: false, hasPendingWrites: false } });
  expect(next).toHaveBeenCalledTimes(1);
});
