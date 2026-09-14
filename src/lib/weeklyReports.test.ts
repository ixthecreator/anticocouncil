import { expect, test } from "bun:test";
import type { Attendance, Meeting } from "../types";
import { buildMeetingExport, meetingExportBlocks, renderMeetingLatex } from "./meetingExport";
import { emptyWorkspace, latestReport, meetingBrief, parseBackup, reportMeetingId, updateReport, weeklyReports } from "./workspace";

const now = "2026-09-13T12:00:00.000Z";
const meeting = (id: string, date: string): Meeting => ({
  id, date, title: id, week: "本周", summary: "", regularReport: "", createdAt: date, issueIds: [],
});
function fixture() {
  const data = emptyWorkspace();
  data.meetings = [meeting("wed", "2026-09-09"), meeting("sun", "2026-09-13"), meeting("next", "2026-09-14")];
  return data;
}
const report = (values: Partial<Attendance> = {}): Attendance => ({
  id: "2026-09-07__a", meetingId: "wed", memberId: "a", memberName: "甲",
  checkedInAt: "2026-09-09T12:00:00.000Z", reportAssigned: true,
  reportStatus: "pending", reportNote: "", ...values,
});

test("Wednesday assignment completed on Sunday is shared weekly but exported only under Sunday", () => {
  const data = fixture();
  const original = report();
  const completed = updateReport(original, original, { reportStatus: "reported", reportNote: "周日汇报正文", reportMeetingId: "sun" }, data.meetings, now);
  data.attendance = [completed];
  expect(completed.meetingId).toBe("wed");
  expect(reportMeetingId(completed)).toBe("sun");
  expect(completed.reportedAt).toBe(now);
  for (const date of ["2026-09-09", "2026-09-13"]) expect(weeklyReports(data, date)).toEqual([completed]);
  const snapshot = buildMeetingExport(data, ["wed", "sun"], "minutes", now);
  expect(snapshot.meetings[0].attendance).toEqual([]);
  expect(snapshot.meetings[1].attendance?.[0].reportNote).toBe("周日汇报正文");
  const pages = meetingExportBlocks(snapshot);
  expect(JSON.stringify(pages[0])).not.toContain("周日汇报正文");
  expect(JSON.stringify(pages[1])).toContain("周日汇报正文");
  expect(meetingBrief(data, "wed")).not.toContain("周日汇报正文");
  expect(meetingBrief(data, "sun")).toContain("周日汇报正文");
  const latex = renderMeetingLatex(snapshot).split("\\clearpage");
  expect(latex[0]).not.toContain("周日汇报正文");
  expect(latex[1]).toContain("周日汇报正文");
  expect(latestReport(data.attendance, "a", "wed", "2026-09-09", data)).toBeUndefined();
  expect(latestReport(data.attendance, "a", "next", "2026-09-14", data)?.id).toBe(completed.id);
});

test("legacy completed or exempt records reset to pending remain assigned with their original ID", () => {
  for (const status of ["reported", "exempt"] as const) {
    const data = fixture();
    const original = report({ id: "wed__a", reportStatus: status, reportAssigned: undefined, reportNote: "旧稿", reportedAt: "2026-09-09T13:00:00Z" });
    const pending = updateReport(original, original, { reportStatus: "pending", reportNote: "", reportMeetingId: "sun" }, data.meetings, now);
    data.attendance = [pending];
    expect(pending.id).toBe(original.id);
    expect(pending.reportAssigned).toBe(true);
    expect(pending.reportMeetingId).toBe("");
    expect(pending.reportedAt).toBe("");
    expect(weeklyReports(data, "2026-09-13")).toEqual([pending]);
    expect(buildMeetingExport(data, ["wed"], "minutes", now).meetings[0].attendance).toHaveLength(1);
    const completed = updateReport(pending, pending, { reportStatus: "reported", reportNote: "续写", reportMeetingId: "sun" }, data.meetings, now);
    expect(completed.id).toBe(original.id);
    expect(completed.reportNote).toBe("续写");
  }
});

test("legacy pending drafts remain readable while blank check-ins stay outside the roster", () => {
  const data = fixture();
  const draft = report({ id: "draft", reportAssigned: undefined, reportNote: "待整理的旧稿" });
  data.attendance = [draft, report({ id: "blank", memberId: "b", reportAssigned: undefined, reportNote: "  " })];
  expect(weeklyReports(data, "2026-09-09")).toEqual([draft]);
  expect(meetingBrief(data, "wed")).toContain("待整理的旧稿");
  const edited = updateReport(draft, draft, { reportStatus: "pending", reportNote: "", reportMeetingId: "" }, data.meetings, now);
  data.attendance = [edited];
  expect(weeklyReports(data, "2026-09-09")).toEqual([edited]);
});

test("editing completed notes retains the actual scene and timestamp unless explicitly reassigned", () => {
  const data = fixture();
  const original = report({ reportStatus: "reported", reportedAt: "2026-09-09T13:00:00Z", reportNote: "旧稿", reportAssigned: undefined });
  const edited = updateReport(original, original, { reportStatus: "reported", reportNote: "修改正文", reportMeetingId: reportMeetingId(original) }, data.meetings, now);
  expect(reportMeetingId(edited)).toBe("wed");
  expect(edited.reportedAt).toBe(original.reportedAt);
  const reassigned = updateReport(edited, edited, { ...edited, reportMeetingId: "sun" }, data.meetings, now);
  expect(reportMeetingId(reassigned)).toBe("sun");
  expect(reassigned.reportedAt).toBe(now);
  expect(reassigned.meetingId).toBe("wed");
});

test("exemptions require a reason and belong to the selected scene without a reported timestamp", () => {
  const data = fixture();
  const original = report();
  expect(() => updateReport(original, original, { reportStatus: "exempt", reportNote: "  ", reportMeetingId: "sun" }, data.meetings, now)).toThrow("原因");
  const exempt = updateReport(original, original, { reportStatus: "exempt", reportNote: "  请假  ", reportMeetingId: "sun" }, data.meetings, now);
  expect(exempt.reportNote).toBe("请假");
  expect(reportMeetingId(exempt)).toBe("sun");
  expect(exempt.reportedAt).toBe("");
});

test("missing and cross-week report scenes and deleted records cannot be saved", () => {
  const data = fixture();
  const original = report();
  for (const reportMeetingId of ["", "deleted", "next"]) {
    expect(() => updateReport(original, original, { reportStatus: "reported", reportNote: "", reportMeetingId }, data.meetings, now)).toThrow("本周");
  }
  expect(() => updateReport(null, original, { ...original }, data.meetings, now)).toThrow("删除");
  expect(() => updateReport(original, original, { ...original }, [], now)).toThrow("会议不存在");
});

test("stale report edits cannot replace newer status, notes, timestamps or meeting ownership", () => {
  const data = fixture();
  const original = report({ reportStatus: "reported", reportMeetingId: "wed", reportedAt: "2026-09-09T13:00:00Z" });
  for (const changes of [{ reportNote: "他人修改" }, { reportStatus: "exempt" as const }, { reportMeetingId: "sun" }, { reportedAt: now }, { meetingId: "sun" }]) {
    expect(() => updateReport({ ...original, ...changes }, original, { ...original, reportNote: "我的输入" }, data.meetings, now)).toThrow("其他成员修改");
  }
  const latest = { ...original, memberName: "更新后的姓名" };
  expect(updateReport(latest, original, { ...original }, data.meetings, now).memberName).toBe("更新后的姓名");
});

test("weekly deduplication does not remove separate historical reports from meeting exports", () => {
  const data = fixture();
  data.attendance = [report({ id: "old-wed", reportStatus: "reported", reportAssigned: undefined, reportNote: "周三历史正文" }), report({ id: "old-sun", meetingId: "sun", reportStatus: "reported", reportAssigned: undefined, reportNote: "周日历史正文" })];
  expect(weeklyReports(data, "2026-09-13")).toHaveLength(1);
  const snapshot = buildMeetingExport(data, ["wed", "sun"], "minutes", now);
  expect(snapshot.meetings[0].attendance?.[0].reportNote).toBe("周三历史正文");
  expect(snapshot.meetings[1].attendance?.[0].reportNote).toBe("周日历史正文");
});

test("backups retain actual report scenes and reject malformed scene fields", () => {
  const row = report({ reportStatus: "reported", reportMeetingId: "sun" });
  expect(parseBackup({ attendance: [row] }).attendance?.[0].reportMeetingId).toBe("sun");
  expect(() => parseBackup({ attendance: [{ ...row, reportMeetingId: 5 }] })).toThrow("文本字段");
  expect(parseBackup({ attendance: [report({ reportAssigned: undefined })] }).attendance).toHaveLength(1);
});
