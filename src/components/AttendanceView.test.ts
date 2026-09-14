import { expect, test } from "bun:test";
import type { Attendance } from "../types";
import { mergeAttendanceReport } from "./AttendanceView";

const original: Attendance = { id: "meeting__member", meetingId: "meeting", memberId: "member", memberName: "成员", checkedInAt: "2026-09-10T08:00:00Z", reportStatus: "pending", reportNote: "" };
const now = "2026-09-10T10:00:00Z";

test("editing a report note preserves another member's completed status and original report time", () => {
  const latest = { ...original, reportStatus: "reported" as const, reportedAt: "2026-09-10T09:00:00Z", memberName: "更新姓名" };
  const result = mergeAttendanceReport(latest, original, { ...original, reportNote: "  已补充内容  " }, now);
  expect(result).toEqual({ ...latest, reportNote: "已补充内容" });
  expect(original.reportNote).toBe("");
});

test("concurrent edits to the same report field fail without mutating the original or draft", () => {
  const latest = { ...original, reportNote: "另一成员的汇报" };
  const draft = { ...original, reportNote: "我的草稿" };
  expect(() => mergeAttendanceReport(latest, original, draft, now)).toThrow("草稿已保留");
  expect(latest.reportNote).toBe("另一成员的汇报");
  expect(draft.reportNote).toBe("我的草稿");
  expect(() => mergeAttendanceReport(null, original, draft, now)).toThrow("已被删除");
});

test("marking reported uses the latest note and stamps the first completion only", () => {
  const latest = { ...original, reportNote: "另一成员刚补充的内容" };
  const reported = mergeAttendanceReport(latest, original, { ...original, reportStatus: "reported" }, now);
  expect(reported).toEqual({ ...latest, reportStatus: "reported", reportedAt: now });
  expect(mergeAttendanceReport(reported, original, { ...original, reportStatus: "reported" }, "later").reportedAt).toBe(now);
  const pending = mergeAttendanceReport(reported, reported, { ...reported, reportStatus: "pending" }, "later");
  expect(pending.reportedAt).toBe("");
});

test("exemption requires a reason in the merged latest record and never keeps a report timestamp", () => {
  expect(() => mergeAttendanceReport(original, original, { ...original, reportStatus: "exempt", reportNote: "  " }, now)).toThrow("免汇报原因");
  const latest = { ...original, reportNote: "周三已汇报" };
  const exempt = mergeAttendanceReport(latest, original, { ...original, reportStatus: "exempt" }, now);
  expect(exempt).toMatchObject({ reportStatus: "exempt", reportNote: "周三已汇报", reportedAt: "" });
});
