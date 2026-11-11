import { expect, test } from "bun:test";
import type { Issue, Meeting } from "../types";
import { emptyWorkspace } from "./workspace";
import {
  fromChineseNumber, meetingNotice, nextMeetingDraft, reminderText,
  reportTemplate, toChineseNumber, withReportTemplate,
} from "./templates";

const meeting = (id: string, date: string, title = id): Meeting => ({
  id, date, title, week: "", summary: "", regularReport: "", createdAt: date, issueIds: [],
});
const issue = (values: Partial<Issue>): Issue => ({
  id: "i", title: "议题", category: "日常", priority: "medium", status: "agenda", description: "",
  discussion: "", signature: "", createdAt: "2026-11-01", updatedAt: "2026-11-01", archived: false,
  meetingId: null, ...values,
});

test("Chinese numerals round-trip", () => {
  for (const [n, text] of [[1, "一"], [10, "十"], [13, "十三"], [20, "二十"], [105, "一百零五"], [1010, "一千零一十"]] as const) {
    expect(toChineseNumber(n)).toBe(text);
    expect(fromChineseNumber(text)).toBe(n);
  }
  expect(fromChineseNumber("两百")).toBe(200);
  expect(Number.isNaN(fromChineseNumber("abc"))).toBe(true);
});

test("next meeting keeps the weekday, lands on or after today and increments the count", () => {
  const meetings = [meeting("a", "2026-10-28", "第十一次例会"), meeting("b", "2026-11-04", "第十二次例会")];
  expect(nextMeetingDraft(meetings, "2026-11-05")).toEqual({ title: "第十三次例会", date: "2026-11-11" });
  // Weeks skipped: still the next upcoming Wednesday.
  expect(nextMeetingDraft(meetings, "2026-11-20")?.date).toBe("2026-11-25");
  expect(nextMeetingDraft([meeting("c", "2026-11-04", "2026年第9次全体会议")], "2026-11-04")?.title).toBe("2026年第10次全体会议");
  expect(nextMeetingDraft([meeting("d", "2026-11-04", "2026年11月4日例会")], "2026-11-04")?.title).toBe("2026年11月11日例会");
  expect(nextMeetingDraft([meeting("e", "2026-11-04", "临时会议")], "2026-11-04")?.title).toBe("2026年11月11日例会");
  expect(nextMeetingDraft([], "2026-11-04")).toBeNull();
});

test("report template appends instead of replacing typed notes", () => {
  const template = reportTemplate(["外联部", "其他"]);
  expect(template).toBe("【外联部】\n本周工作：\n下周计划：\n需协调事项：\n\n【其他事项】\n");
  expect(withReportTemplate("", template)).toBe(template);
  expect(withReportTemplate("已有记录\n", template)).toBe(`已有记录\n\n${template}`);
});

test("meeting notice lists pending speakers, agenda and open votes", () => {
  const data = emptyWorkspace();
  data.meetings = [meeting("m", "2026-11-11", "第十三次例会")];
  data.attendance = [
    { id: "r1", meetingId: "m", memberId: "a", memberName: "张三", checkedInAt: "2026-11-09T01:00:00Z", reportStatus: "pending", reportNote: "", reportAssigned: true },
    { id: "r2", meetingId: "m", memberId: "b", memberName: "李四", checkedInAt: "2026-11-09T02:00:00Z", reportStatus: "reported", reportNote: "", reportAssigned: true, reportMeetingId: "m" },
  ];
  data.issues = [
    issue({ id: "1", title: "预算", meetingId: "m" }),
    issue({ id: "2", title: "章程修订", meetingId: "m", status: "voting", category: "制度" }),
    issue({ id: "3", title: "已归档", meetingId: "m", archived: true }),
  ];
  const text = meetingNotice(data, "m");
  expect(text).toContain("【会议通知】第十三次例会");
  expect(text).toContain("时间：2026-11-11 星期三");
  expect(text).toContain("本周汇报：张三");
  expect(text).not.toContain("李四");
  expect(text).toContain("待讨论议题：\n1. 预算（日常）");
  expect(text).toContain("进行中的表决：\n1. 章程修订（制度）");
  expect(text).not.toContain("已归档");
  expect(meetingNotice(data, "missing")).toBe("");
});

test("reminder groups overdue and soon-due follow-ups by owner", () => {
  const members = [{ id: "a", name: "张三", role: "", avatarSymbol: "" }];
  const issues = [
    issue({ id: "1", title: "采购", status: "execution", signature: "a", dueDate: "2026-11-09" }),
    issue({ id: "2", title: "场地", status: "authorization", signature: "a", dueDate: "2026-11-14" }),
    issue({ id: "3", title: "太远", status: "execution", signature: "a", dueDate: "2026-11-30" }),
    issue({ id: "4", title: "完成了", status: "completed", signature: "a", dueDate: "2026-11-01" }),
    issue({ id: "5", title: "无人负责", status: "passed", dueDate: "2026-11-11" }),
  ];
  const text = reminderText(issues, members, "2026-11-11");
  expect(text).toContain("张三：\n· 采购（执行中，已逾期 2 天，截止 2026-11-09）\n· 场地（待执行，3 天后截止，截止 2026-11-14）");
  expect(text).toContain("待安排负责人：\n· 无人负责（已通过，今天截止，截止 2026-11-11）");
  expect(text).not.toContain("太远");
  expect(text).not.toContain("完成了");
  expect(reminderText([], members, "2026-11-11")).toBe("");
});
