import { expect, test } from "bun:test";
import type { Meeting } from "../types";
import { renameMeeting } from "./meetingRename";

function meeting(): Meeting {
  return {
    id: "existing-meeting-id",
    title: "九月例会",
    date: "2026-09-09",
    week: "星期三",
    createdAt: "2026-09-01T10:00:00Z",
    summary: "另一位成员刚更新的摘要",
    regularReport: "另一位成员刚保存的会议记录",
    issueIds: ["issue-a", "issue-b"],
  };
}

test("rename trims the title and preserves the latest meeting and associated IDs", () => {
  const latest = { ...meeting(), extraImportedField: "保留导入的扩展字段" };
  const original = structuredClone(latest);
  const renamed = renameMeeting(latest, "九月例会", "  九月工作例会\n");

  expect(renamed).toEqual({ ...original, title: "九月工作例会" });
  expect(renamed).not.toBe(latest);
  expect(latest).toEqual(original);
});

test("a stale title cannot overwrite another member's rename and reports the latest name", () => {
  const latest = { ...meeting(), title: "已经确认的名称" };

  expect(() => renameMeeting(latest, "九月例会", "我的旧草稿")).toThrow(
    "会议名称已被其他成员修改为“已经确认的名称”",
  );
  expect(latest.title).toBe("已经确认的名称");
});

test("retrying an already applied rename succeeds without replacing newer meeting content", () => {
  const latest = { ...meeting(), title: "九月工作例会" };

  expect(renameMeeting(latest, "九月例会", " 九月工作例会 ")).toBe(latest);
});

test("blank titles and deleted meetings are rejected", () => {
  for (const title of ["", " \n\t ", "\u3000"]) {
    expect(() => renameMeeting(meeting(), "九月例会", title)).toThrow(
      "会议名称不能为空",
    );
  }
  expect(() => renameMeeting(null, "九月例会", "新名称")).toThrow(
    "会议不存在，可能已被删除",
  );
});
