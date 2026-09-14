import { test, expect } from "bun:test";
import {
  emptyWorkspace,
  latestReport,
  meetingBrief,
  parseBackup,
  recordBallot,
  safeUrl,
  voteTotals,
  votingResult,
  weekday,
  advanceIssue,
  reportingWeek,
  weeklyReports,
} from "./workspace";

test("stale workflow actions cannot reverse newer decisions", () => {
  expect(() =>
    advanceIssue({ ...issue(), status: "rejected" }, "agenda", "execution"),
  ).toThrow();
  expect(() =>
    advanceIssue(
      { ...issue(), status: "completed" },
      "passed",
      "authorization",
    ),
  ).toThrow();
  const original = {
    ...issue(),
    status: "passed",
    ballots: { a: "approve" },
  } as Issue;
  expect(advanceIssue(original, "passed", "authorization").ballots).toEqual(
    original.ballots,
  );
});
import { escapeLatex, latexDocument } from "./latex";
import type { Issue, Attendance, Meeting } from "../types";
const meeting = (id: string, date = "2026-09-06"): Meeting => ({
  id,
  title: `例会${id}`,
  week: "星期日",
  date,
  createdAt: date,
  summary: "摘要",
  regularReport: "记录",
  issueIds: [],
});
const issue = (): Issue => ({
  id: "i1",
  title: "议题",
  category: "其他",
  priority: "medium",
  status: "voting",
  description: "",
  discussion: "",
  signature: "甲",
  createdAt: "2026-09-06",
  updatedAt: "2026-09-06",
  archived: false,
  meetingId: "m1",
  voteMode: "members",
  voteRule: "simple",
  ballots: {},
});
const record = (
  id: string,
  meetingId: string,
  status: Attendance["reportStatus"] = "reported",
): Attendance => ({
  id,
  meetingId,
  memberId: "a",
  memberName: "甲",
  checkedInAt: "2026-09-06T12:00:00Z",
  reportStatus: status,
  reportNote: "进展",
});
test("one member can revise a ballot without adding turnout", () => {
  let value = recordBallot(issue(), "a", "approve");
  value = recordBallot(value, "a", "reject");
  expect(voteTotals(value)).toEqual({ approve: 0, reject: 1, abstain: 0 });
});
test("distinct voters are preserved and closed votes reject updates", () => {
  let value = recordBallot(
    recordBallot(issue(), "a", "approve"),
    "b",
    "abstain",
  );
  expect(voteTotals(value)).toEqual({ approve: 1, reject: 0, abstain: 1 });
  expect(() =>
    recordBallot({ ...value, status: "passed" }, "b", "reject"),
  ).toThrow();
});
test("simple majority ignores abstentions; absolute majority includes them; ties fail", () => {
  const value = {
    ...issue(),
    ballots: { a: "approve", b: "abstain" },
  } as Issue;
  expect(votingResult(value)).toBe("passed");
  expect(votingResult({ ...value, voteRule: "absolute" })).toBe("rejected");
  expect(
    votingResult({ ...value, ballots: { a: "approve", b: "reject" } }),
  ).toBe("rejected");
  expect(votingResult(issue())).toBe("rejected");
});
test("legacy manual votes remain readable", () => {
  const value = {
    ...issue(),
    voteMode: undefined,
    ballots: undefined,
    votes: { approve: 2, reject: 1, abstain: 0 },
  };
  expect(voteTotals(value)).toEqual(value.votes);
  expect(votingResult(value)).toBe("passed");
});
test("report history excludes future meetings and exemption records", () => {
  const data = emptyWorkspace();
  data.meetings = [
    meeting("past", "2026-09-02"),
    meeting("now"),
    meeting("future", "2026-09-09"),
  ];
  const records = [
    record("1", "past"),
    record("2", "future"),
    record("3", "now", "exempt"),
  ];
  expect(latestReport(records, "a", "now", "2026-09-06", data)?.id).toBe("1");
});
test("two meetings in one Monday–Sunday cycle share a single report assignment", () => {
  const data = emptyWorkspace();
  data.meetings = [meeting("first", "2026-09-09"), meeting("second", "2026-09-13"), meeting("next", "2026-09-14")];
  data.attendance = [record("old", "first", "pending"), record("done", "second", "reported"), record("following", "next")];
  expect(reportingWeek("2026-09-09")).toBe("2026-09-07");
  expect(reportingWeek("2026-09-13")).toBe("2026-09-07");
  expect(weeklyReports(data, "2026-09-09").map((row) => row.id)).toEqual(["done"]);
  expect(weeklyReports(data, "2026-09-14").map((row) => row.id)).toEqual(["following"]);
});
test("legacy check-ins alone do not put everyone on the reporting roster", () => {
  const data = emptyWorkspace();
  data.meetings = [meeting("first", "2026-09-09"), meeting("second", "2026-09-13")];
  data.attendance = [{ ...record("check-in", "first", "pending"), reportNote: "" }, { ...record("assigned", "second", "pending"), memberId: "b", reportAssigned: true }];
  expect(weeklyReports(data, "2026-09-09").map((row) => row.id)).toEqual(["assigned"]);
  expect(meetingBrief(data, "first")).not.toContain("甲｜待汇报");
  expect(() => parseBackup({ attendance: [{ ...data.attendance[1], reportAssigned: "yes" }] })).toThrow("汇报安排标记");
});
test("complete minutes retain rejected issues, attendance and results", () => {
  const data = emptyWorkspace();
  data.meetings = [meeting("m1")];
  data.attendance = [record("1", "m1", "exempt")];
  data.issues = [{ ...issue(), status: "rejected", ballots: { a: "reject" } }];
  const text = meetingBrief(data, "m1");
  expect(text).toContain("本次免汇报");
  expect(text).toContain("已否决");
  expect(text).toContain("反对 1");
});
test("legacy backups merge without requiring new collections", () => {
  const parsed = parseBackup({
    meetings: [meeting("m1")],
    issues: [issue()],
    members: [],
    activities: [],
  });
  expect(parsed.attendance).toBeUndefined();
  expect(parsed.meetings?.length).toBe(1);
});
test("backup rejects malformed optional values before modifying anything", () => {
  expect(() =>
    parseBackup({ meetings: [{ ...meeting("m"), regularReport: {} }] }),
  ).toThrow();
  expect(() =>
    parseBackup({
      issues: [{ ...issue(), votes: { approve: {}, reject: 0, abstain: 0 } }],
    }),
  ).toThrow();
  expect(() =>
    parseBackup({ issues: [{ ...issue(), status: "toString" }] }),
  ).toThrow();
  expect(() =>
    parseBackup({
      inventory: [
        {
          id: "x",
          title: "明信片",
          location: "A",
          keeper: "",
          notes: "",
          quantity: -1,
        },
      ],
    }),
  ).toThrow();
});
test("backup rejects duplicate and unsafe identifiers", () => {
  expect(() =>
    parseBackup({ meetings: [meeting("m"), meeting("m")] }),
  ).toThrow();
  expect(() => parseBackup({ meetings: [meeting("../m")] })).toThrow();
});
test("resource links reject executable and local URL schemes", () => {
  expect(safeUrl("javascript:alert(1)")).toBe("");
  expect(safeUrl("file:///a")).toBe("");
  expect(safeUrl("https://example.com/card")).toBe("https://example.com/card");
});
test("date-only values preserve weekdays in negative UTC offsets", () => {
  expect(weekday("2026-09-06")).toBe("星期日");
  expect(weekday("")).toBe("");
});
test("Chinese LaTeX exports escape user content and include reports", () => {
  const data = emptyWorkspace();
  data.meetings = [
    { ...meeting("m"), title: "A&B_100%", regularReport: "周三已汇报" },
  ];
  const result = latexDocument(data, ["m"]);
  expect(result).toContain("ctexart");
  expect(result).toContain("A\\&B\\_100\\%");
  expect(result).toContain("周三已汇报");
  expect(escapeLatex("\\input{x}")).toBe("\\textbackslash{}input\\{x\\}");
});
