import { expect, test } from "bun:test";
import type { Issue, Meeting, WorkspaceData } from "../types";
import { emptyWorkspace } from "./workspace";
import {
  deadlineLabel,
  featuredMeeting,
  overviewData,
  responsibleName,
} from "./councilOverview";
import { workspacePageFromHash, workspaceTheme } from "./workspaceNavigation";

const meeting = (id: string, date: string): Meeting => ({
  id,
  title: id,
  date,
  week: "例会",
  summary: "",
  createdAt: `${date}T12:00:00`,
  issueIds: [],
});
const issue = (id: string, status: Issue["status"], dueDate = ""): Issue => ({
  id,
  title: id,
  status,
  dueDate,
  category: "编辑部",
  priority: "medium",
  description: "",
  discussion: "",
  signature: "person",
  createdAt: "2026-09-01",
  updatedAt: "2026-09-01",
  archived: false,
  meetingId: "m1",
});

test("deadline badges distinguish today and overdue using local calendar dates", () => {
  expect(deadlineLabel("2026-09-09", "2026-09-09")).toEqual({
    text: "今日截止",
    tone: "amber",
  });
  expect(deadlineLabel("2026-09-09", "2026-09-10")).toEqual({
    text: "已逾期",
    tone: "red",
  });
  expect(deadlineLabel("2026-09-10", "2026-09-09")).toBeNull();
  for (const value of [
    undefined,
    "",
    "invalid",
    "2026-02-29",
    "2026-13-01",
    "2026-09-09T00:00:00Z",
  ])
    expect(deadlineLabel(value, "2026-09-09")).toBeNull();
  expect(deadlineLabel("2028-02-29", "2028-02-29")?.text).toBe("今日截止");
});

test("featured meeting chooses the nearest upcoming date and falls back to the latest history", () => {
  const meetings = [
    meeting("future", "2026-10-01"),
    meeting("past", "2026-09-01"),
    meeting("today", "2026-09-09"),
  ];
  const original = [...meetings];
  expect(featuredMeeting(meetings, "2026-09-09")?.id).toBe("today");
  expect(featuredMeeting(meetings, "2026-09-10")?.id).toBe("future");
  expect(featuredMeeting(meetings, "2026-11-01")?.id).toBe("future");
  expect(featuredMeeting([], "2026-09-09")).toBeNull();
  expect(meetings).toEqual(original);
});

test("overview combines real unfinished work and gives each of two due-today tasks its own badge", () => {
  const data: WorkspaceData = {
    ...emptyWorkspace(),
    members: [
      { id: "person", name: "林同学", role: "编辑", avatarSymbol: "林" },
    ],
    issues: [
      issue("today", "execution", "2026-09-09"),
      issue("overdue", "authorization", "2026-09-08"),
      issue("ballot", "voting"),
      issue("agenda", "agenda"),
      issue("done", "completed", "2026-09-09"),
      issue("rejected", "rejected"),
      { ...issue("archived", "passed", "2026-09-09"), archived: true },
    ],
    editorial: [
      {
        id: "editorial",
        title: "提交编辑专题排期并确认每一篇稿件的负责编辑、作者与最终交付时间",
        department: "微信编辑部",
        author: "",
        editor: "林同学",
        designer: "",
        dueDate: "2026-09-09",
        status: "编辑",
        notes: "",
      },
      {
        id: "published",
        title: "已经发布",
        department: "QQ编辑部",
        author: "",
        editor: "",
        designer: "",
        dueDate: "2026-09-09",
        status: "已发布",
        notes: "",
      },
    ],
  };
  const snapshot = JSON.stringify(data);
  const overview = overviewData(data, "2026-09-09");
  expect(overview.actions.map((item) => item.id)).toEqual([
    "issue-overdue",
    "issue-today",
    "editorial-editorial",
    "issue-ballot",
  ]);
  expect(
    overview.actions.filter(
      (item) => deadlineLabel(item.dueDate, "2026-09-09")?.text === "今日截止",
    ),
  ).toHaveLength(2);
  expect(
    overview.actions.find((item) => item.id === "issue-today")?.description,
  ).toBe("编辑部 · 林同学");
  expect(overview.agenda.map((item) => item.id)).toEqual(["ballot", "agenda"]);
  expect(overview.completed).toBe(1);
  expect(overview.executionCount).toBe(4);
  expect(JSON.stringify(data)).toBe(snapshot);
});

test("responsible names accept existing member IDs and legacy free text", () => {
  const data = {
    ...emptyWorkspace(),
    members: [
      { id: "person", name: "林同学", role: "编辑", avatarSymbol: "林" },
    ],
  };
  expect(responsibleName(issue("id", "passed"), data)).toBe("林同学");
  expect(
    responsibleName(
      { ...issue("legacy", "passed"), signature: "临时工作组" },
      data,
    ),
  ).toBe("临时工作组");
  expect(
    responsibleName({ ...issue("none", "passed"), signature: "" }, data),
  ).toBe("待安排负责人");
});

test("recent records need saved meeting notes or an archived issue and never invent history", () => {
  const data = {
    ...emptyWorkspace(),
    meetings: [
      meeting("empty", "2026-09-09"),
      { ...meeting("notes", "2026-09-08"), summary: "会议纪要" },
      meeting("m1", "2026-09-07"),
      { ...meeting("future", "2026-09-10"), summary: "计划" },
    ],
    issues: [{ ...issue("archived", "completed"), archived: true }],
  };
  expect(
    overviewData(data, "2026-09-09").recentRecords.map((item) => item.id),
  ).toEqual(["notes", "m1"]);
  const empty = overviewData(emptyWorkspace(), "2026-09-09");
  expect(empty.featured).toBeNull();
  expect(empty.actions).toEqual([]);
  expect(empty.recentRecords).toEqual([]);
  expect(empty.executionCount).toBe(0);
  expect(empty.completed).toBe(0);
});

test("navigation preserves all legacy deep links and saved themes", () => {
  for (const page of [
    "overview",
    "proposals",
    "session",
    "post",
    "archive",
    "supervision",
    "activity",
    "editorial",
    "assets",
    "inventory",
  ] as const)
    expect(workspacePageFromHash(`#${page}`)).toBe(page);
  expect(workspacePageFromHash("")).toBe("overview");
  expect(workspacePageFromHash("#unknown")).toBe("overview");
  for (const theme of [
    "parliament",
    "classic",
    "prussian",
    "burgundy",
    "latenight",
  ] as const)
    expect(workspaceTheme(theme)).toBe(theme);
  expect(workspaceTheme(null)).toBe("parliament");
  expect(workspaceTheme("unknown")).toBe("parliament");
});
