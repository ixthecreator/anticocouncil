import { expect, test } from "bun:test";
import { mergeEditedRecord } from "./editRecord";

test("moving stock preserves a quantity another member has already reduced", () => {
  const original = {
    id: "stock",
    title: "明信片",
    quantity: 100,
    location: "柜一",
    notes: "",
  };
  const latest = {
    ...original,
    quantity: 80,
    notes: "已领取 20 张",
    importedField: "保留",
  };
  const edited = { ...original, location: "柜二" };
  const result = mergeEditedRecord(latest, original, edited, [
    "title",
    "quantity",
    "location",
    "notes",
  ]);

  expect(result).toEqual({ ...latest, location: "柜二" });
  expect(latest.quantity).toBe(80);
  expect(original.location).toBe("柜一");
  expect(edited.quantity).toBe(100);
});

test("competing stock quantity edits fail without changing either latest data or the draft", () => {
  const original = { id: "stock", quantity: 100, location: "柜一" };
  const latest = { ...original, quantity: 80 };
  const edited = { ...original, quantity: 90, location: "柜二" };

  expect(() =>
    mergeEditedRecord(latest, original, edited, ["quantity", "location"]),
  ).toThrow("已被其他成员更新");
  expect(latest).toEqual({ ...original, quantity: 80 });
  expect(edited).toEqual({ ...original, quantity: 90, location: "柜二" });
});

test("an activity title edit cannot revert another member's schedule change", () => {
  const original = {
    id: "activity",
    name: "线上沙龙",
    time: "2026-09-10T19:00",
    status: "planned",
  };
  const latest = { ...original, time: "2026-09-11T19:00" };
  const edited = { ...original, name: "九月线上沙龙" };

  expect(
    mergeEditedRecord(latest, original, edited, ["name", "time", "status"]),
  ).toEqual({ ...latest, name: edited.name });
});

test("editorial field clearing is a deliberate edit while unlisted metadata stays current", () => {
  const original = {
    id: "article",
    status: "编辑",
    notes: "待确认",
    updatedAt: "old",
  };
  const latest = { ...original, status: "排版", updatedAt: "latest" };
  const edited = { ...original, notes: "", updatedAt: "draft" };

  expect(
    mergeEditedRecord(latest, original, edited, ["status", "notes"]),
  ).toEqual({ ...latest, notes: "" });
});

test("different replacement attachments conflict instead of silently losing a file", () => {
  const original = { id: "asset", fileName: "原图.png", fileData: "old" };
  const latest = { ...original, fileName: "已更新.png", fileData: "latest" };
  const edited = { ...original, fileName: "我的草稿.png", fileData: "draft" };

  expect(() =>
    mergeEditedRecord(latest, original, edited, ["fileName", "fileData"]),
  ).toThrow("草稿已保留");
  expect(latest.fileData).toBe("latest");
  expect(edited.fileData).toBe("draft");
});

test("saving a draft left open after deletion never recreates that record", () => {
  for (const id of ["editorial", "asset", "inventory", "activity", "issue"]) {
    const original = { id, title: "原记录" };
    const edited = { ...original, title: "仍打开的草稿" };
    expect(() => mergeEditedRecord(null, original, edited, ["title"])).toThrow(
      "已被删除",
    );
    expect(edited.title).toBe("仍打开的草稿");
  }
});

test("new records require an unused ID and preserve their initial defaults", () => {
  const edited = { id: "new", title: "新选题", status: "选题" };
  const result = mergeEditedRecord(null, null, edited, ["title"]);
  expect(result).toEqual(edited);
  expect(result).not.toBe(edited);
  expect(() =>
    mergeEditedRecord({ ...edited, title: "已有记录" }, null, edited, [
      "title",
    ]),
  ).toThrow("此记录已存在");
});

test("retrying an already applied edit retains unrelated new values", () => {
  const original = { id: "item", title: "旧名", notes: "旧备注" };
  const edited = { ...original, title: "新名" };
  const latest = { ...edited, notes: "之后更新的备注" };
  expect(
    mergeEditedRecord(latest, original, edited, ["title", "notes"]),
  ).toEqual(latest);
});

test("record identities cannot be changed or applied to another record", () => {
  const original = { id: "a", title: "记录 A" };
  expect(() =>
    mergeEditedRecord(original, original, { ...original, id: "b" }, [
      "id",
      "title",
    ]),
  ).toThrow("记录编号不一致");
  expect(() =>
    mergeEditedRecord({ ...original, id: "b" }, original, original, ["title"]),
  ).toThrow("记录编号不一致");
  expect(() =>
    mergeEditedRecord(null, null, { ...original, id: "" }, ["title"]),
  ).toThrow("记录编号不一致");
});

test("equal structured field snapshots do not create false conflicts after loading", () => {
  const original = {
    id: "item",
    title: "原名",
    details: { tags: ["资料"], enabled: true },
  };
  const edited = structuredClone(original);
  edited.title = "新名";
  const latest = {
    ...original,
    details: { enabled: true, tags: ["资料", "已复核"] },
  };
  expect(
    mergeEditedRecord(latest, original, edited, ["title", "details"]),
  ).toEqual({ ...latest, title: "新名" });
});
