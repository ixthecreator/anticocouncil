import { expect, test } from "bun:test";
import type { Issue, Meeting, WorkspaceData } from "../types";
import { emptyWorkspace } from "./workspace";
import { buildMeetingExport, escapeMeetingLatex, exportMeetingFileName, meetingExportBlocks, renderMeetingLatex } from "./meetingExport";

const createdAt = "2026-09-01T12:00:00.000Z";
const generatedAt = "2026-09-09T14:05:06.000Z";
const meeting = (id: string, date = "2026-09-01"): Meeting => ({ id, title: `会议 ${id}`, date, week: "第 1 周", summary: "会后摘要", regularReport: "常规报告", createdAt, issueIds: ["stale-reference"] });
const issue = (id: string, values: Partial<Issue> = {}): Issue => ({
  id, title: `议题 ${id}`, category: "编辑部", priority: "medium", status: "agenda", description: "事项说明", discussion: "会后讨论", signature: "member-1", createdAt, updatedAt: createdAt, archived: false, meetingId: "m1", ...values,
});
function fixture(): WorkspaceData {
  const data = emptyWorkspace();
  data.meetings = [meeting("m1")];
  data.members = [{ id: "member-1", name: "已绑定姓名", role: "委员", avatarSymbol: "A" }];
  data.attendance = [{ id: "a1", meetingId: "m1", memberId: "member-1", memberName: "签到时姓名", checkedInAt: createdAt, reportStatus: "reported", reportNote: "签到汇报记录" }];
  return data;
}

test("agenda excludes post-meeting/private fields, archived issues and stale meeting references", () => {
  const data = fixture();
  data.issues = [
    issue("included", { status: "passed", ballots: { privateVoter: "approve" }, voteMode: "members" }),
    issue("archived", { archived: true }),
    issue("stale-reference", { meetingId: "other" }),
  ];
  const snapshot = buildMeetingExport(data, ["m1"], "agenda", generatedAt);
  expect(snapshot.meetings[0].issues.map((item) => item.id)).toEqual(["included"]);
  expect(snapshot.meetings[0].regularReport).toBe("常规报告");
  expect(snapshot.meetings[0].issues[0].responsibleName).toBe("已绑定姓名");
  const raw = JSON.stringify(snapshot);
  for (const field of ["summary", "attendance", "discussion", "archived", "voteSummary", "ballots", "privateVoter"]) expect(raw).not.toContain(`"${field}"`);
  const rendered = JSON.stringify(meetingExportBlocks(snapshot));
  for (const value of ["会后摘要", "会后讨论", "签到时姓名", "签到汇报记录", "表决汇总", "归档状态"]) expect(rendered).not.toContain(value);
});

test("minutes include archived issues and only closed vote aggregates without identity maps", () => {
  const data = fixture();
  data.issues = [
    issue("open", { status: "voting", voteMode: "members", ballots: { secretA: "reject" } }),
    issue("closed", { status: "passed", archived: true, voteMode: "members", ballots: { secretB: "approve", secretC: "abstain" }, voteRule: "absolute" }),
    issue("legacy", { status: "rejected", votes: { approve: 1, reject: 2, abstain: 3 }, signature: "手填负责人" }),
    issue("no-vote", { status: "completed" }),
  ];
  const snapshot = buildMeetingExport(data, ["m1"], "minutes", generatedAt);
  const items = snapshot.meetings[0].issues;
  expect(items.find((item) => item.id === "open")?.voteSummary).toBeUndefined();
  expect(items.find((item) => item.id === "closed")?.voteSummary).toEqual({ approve: 1, reject: 0, abstain: 1, rule: "赞成超过已投票数的一半" });
  expect(items.find((item) => item.id === "closed")?.archived).toBe(true);
  expect(items.find((item) => item.id === "legacy")?.responsibleName).toBe("手填负责人");
  expect(items.find((item) => item.id === "no-vote")?.voteSummary).toBeUndefined();
  expect(snapshot.meetings[0].attendance?.[0].name).toBe("签到时姓名");
  for (const text of [JSON.stringify(snapshot), JSON.stringify(meetingExportBlocks(snapshot)), renderMeetingLatex(snapshot)]) {
    for (const privateValue of ["secretA", "secretB", "secretC", "ballots"]) expect(text).not.toContain(privateValue);
  }
});

test("export ordering is stable and later workspace edits do not change the snapshot", () => {
  const data = fixture();
  data.meetings = [meeting("later", "2026-10-01"), meeting("m2"), meeting("m1")];
  data.issues = [issue("b"), issue("a"), issue("first", { createdAt: "2026-08-01" })];
  const before = JSON.stringify(data);
  const snapshot = buildMeetingExport(data, ["later", "m2", "m1", "m1"], "minutes", new Date(generatedAt));
  expect(snapshot.meetings.map((item) => item.id)).toEqual(["m1", "m2", "later"]);
  expect(snapshot.meetings[0].issues.map((item) => item.id)).toEqual(["first", "a", "b"]);
  expect(JSON.stringify(data)).toBe(before);
  const exported = JSON.stringify(snapshot);
  data.meetings[2].summary = "后续改动";
  data.issues[0].title = "后续改动";
  data.members[0].name = "后续改动";
  data.attendance[0].reportNote = "后续改动";
  expect(JSON.stringify(snapshot)).toBe(exported);
});

test("unknown/empty meeting selections and invalid export times fail before rendering", () => {
  expect(() => buildMeetingExport(fixture(), [], "agenda", generatedAt)).toThrow("请选择");
  expect(() => buildMeetingExport(fixture(), ["missing"], "minutes", generatedAt)).toThrow("请选择");
  expect(() => buildMeetingExport(fixture(), ["m1"], "minutes", "invalid")).toThrow("导出时间");
});

test("LaTeX emits actual newlines, long tables, safe user text and meeting page breaks", () => {
  const data = fixture();
  data.meetings.push(meeting("m2", "2026-09-02"));
  data.meetings[0].title = "A&B_100% {事项}";
  data.meetings[0].regularReport = "首行\n第二行 \\input{secret}";
  data.issues = [issue("one")];
  const snapshot = buildMeetingExport(data, ["m2", "m1"], "minutes", generatedAt);
  const latex = renderMeetingLatex(snapshot);
  expect(latex).toContain("\n\\documentclass");
  expect(latex).toContain("A\\&B\\_100\\% \\{事项\\}");
  expect(latex).toContain("首行\\par\n第二行 \\textbackslash{}input\\{secret\\}\\par");
  expect(latex).toContain("\\begin{longtable}");
  expect(latex).toContain("\\endhead");
  expect(latex).toContain("\n\\clearpage\n");
  expect(latex).not.toContain("\\input{secret}");
  expect(escapeMeetingLatex("$^~#_&%{}\\")).toBe("\\$\\textasciicircum{}\\textasciitilde{}\\#\\_\\&\\%\\{\\}\\textbackslash{}");
  expect(exportMeetingFileName(snapshot, "tex")).toBe("安提柯_完整会议纪要_2场会议_2026-09-09.tex");
  const single = buildMeetingExport(data, ["m1"], "agenda", generatedAt);
  single.meetings[0].title = "../标题:/文件?*";
  expect(exportMeetingFileName(single, "docx")).not.toMatch(/[/:?*]/);
});
