// One-click drafts for routine council paperwork. Every function here only
// produces text or form values; people review and edit before anything is saved
// or sent, and the manual paths stay available beside each shortcut.
import type { Issue, Meeting, Member, WorkspaceData } from "../types";
import { DEFAULT_DEPARTMENTS } from "../types";
import { statusLabels, weekday, weeklyReports } from "./workspace";

const DIGITS = "零一二三四五六七八九";

/** 1–9999 as Chinese numerals: 13 → 十三, 20 → 二十, 105 → 一百零五. */
export function toChineseNumber(value: number): string {
  if (!Number.isInteger(value) || value <= 0 || value > 9999) return String(value);
  const units = ["", "十", "百", "千"];
  const digits = String(value).split("").map(Number);
  let out = "";
  let zero = false;
  digits.forEach((digit, index) => {
    const unit = units[digits.length - 1 - index];
    if (digit === 0) {
      zero = out !== "";
      return;
    }
    if (zero) out += "零";
    zero = false;
    out += DIGITS[digit] + unit;
  });
  return out.startsWith("一十") ? out.slice(1) : out;
}

/** Inverse of toChineseNumber for 1–9999; returns NaN for anything else. */
export function fromChineseNumber(text: string): number {
  if (/^\d+$/.test(text)) return Number(text);
  if (!/^[零〇一二两三四五六七八九十百千]+$/.test(text)) return NaN;
  const unitValue: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let digit = 0;
  for (const char of text.replace(/〇/g, "零").replace(/两/g, "二")) {
    if (char in unitValue) {
      total += (digit || 1) * unitValue[char];
      digit = 0;
    } else {
      digit = DIGITS.indexOf(char);
    }
  }
  return total + digit;
}

const addDays = (date: string, days: number) => {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
};

const dateTitle = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日例会`;
};

/**
 * The next regular meeting after the latest one: same weekday, the first such
 * date on or after today, and the title's 第N次 count (Chinese or Arabic)
 * incremented. Titles without a count fall back to the date-based default.
 */
export function nextMeetingDraft(
  meetings: readonly Meeting[],
  today: string,
): { title: string; date: string } | null {
  const valid = meetings.filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date));
  const last = [...valid].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )[0];
  if (!last) return null;
  let date = addDays(last.date, 7);
  while (date < today) date = addDays(date, 7);
  const counted = last.title.match(/第([零〇一二两三四五六七八九十百千\d]+)(次|期|届)/);
  let title = dateTitle(date);
  if (counted) {
    const n = fromChineseNumber(counted[1]);
    if (Number.isFinite(n) && n > 0) {
      const nextN = n + 1;
      const formatted = /^\d+$/.test(counted[1]) ? String(nextN) : toChineseNumber(nextN);
      title = last.title.replace(counted[0], `第${formatted}${counted[2]}`);
    }
  }
  return { title, date };
}

/** A department-by-department skeleton for the regular report. */
export function reportTemplate(departments: readonly string[] = DEFAULT_DEPARTMENTS): string {
  const sections = departments
    .filter((name) => name !== "其他")
    .map((name) => `【${name}】\n本周工作：\n下周计划：\n需协调事项：`);
  return [...sections, "【其他事项】\n"].join("\n\n");
}

/** Insert the template without losing anything already typed. */
export function withReportTemplate(current: string, template = reportTemplate()): string {
  return current.trim() ? `${current.replace(/\s+$/, "")}\n\n${template}` : template;
}

const memberName = (issue: Issue, members: readonly Member[]) =>
  members.find((m) => m.id === issue.signature)?.name || issue.signature || "待安排负责人";

/** Pre-meeting notice for a group chat: time, speakers, agenda and open votes. */
export function meetingNotice(data: WorkspaceData, meetingId: string): string {
  const meeting = data.meetings.find((m) => m.id === meetingId);
  if (!meeting) return "";
  const issues = data.issues.filter((i) => i.meetingId === meeting.id && !i.archived);
  const agenda = issues.filter((i) => i.status === "agenda");
  const voting = issues.filter((i) => i.status === "voting");
  const speakers = weeklyReports(data, meeting.date)
    .filter((r) => r.reportStatus === "pending")
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt))
    .map((r) => r.memberName);
  const list = (items: Issue[]) =>
    items.map((i, n) => `${n + 1}. ${i.title}${i.category ? `（${i.category}）` : ""}`).join("\n");
  return [
    `【会议通知】${meeting.title}`,
    `时间：${meeting.date} ${weekday(meeting.date) || meeting.week}`,
    `本周汇报：${speakers.join("、") || "暂未安排"}`,
    agenda.length ? `待讨论议题：\n${list(agenda)}` : "待讨论议题：暂无",
    ...(voting.length ? [`进行中的表决：\n${list(voting)}`] : []),
    "请各位准时参会；如需请假或免汇报，请提前告知。",
  ].join("\n\n");
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);

/** Follow-up items due within `withinDays` (or overdue), grouped by owner. */
export function reminderItems(
  issues: readonly Issue[],
  members: readonly Member[],
  today: string,
  withinDays = 3,
) {
  return issues
    .filter(
      (i) =>
        !i.archived &&
        ["passed", "authorization", "execution"].includes(i.status) &&
        /^\d{4}-\d{2}-\d{2}$/.test(i.dueDate || "") &&
        daysBetween(today, i.dueDate!) <= withinDays,
    )
    .map((i) => ({ issue: i, owner: memberName(i, members), days: daysBetween(today, i.dueDate!) }))
    .sort((a, b) => a.days - b.days || a.issue.title.localeCompare(b.issue.title));
}

/** Reminder text for the follow-up list; "" when nothing is due. */
export function reminderText(
  issues: readonly Issue[],
  members: readonly Member[],
  today: string,
  withinDays = 3,
): string {
  const items = reminderItems(issues, members, today, withinDays);
  if (!items.length) return "";
  const owners = new Map<string, typeof items>();
  for (const item of items) owners.set(item.owner, [...(owners.get(item.owner) || []), item]);
  const when = (days: number) =>
    days < 0 ? `已逾期 ${-days} 天` : days === 0 ? "今天截止" : `${days} 天后截止`;
  return [
    `【督办提醒】截至 ${today}，以下事项已逾期或将在 ${withinDays} 天内到期：`,
    ...[...owners].map(
      ([owner, rows]) =>
        `${owner}：\n${rows
          .map(({ issue, days }) => `· ${issue.title}（${statusLabels[issue.status]}，${when(days)}，截止 ${issue.dueDate}）`)
          .join("\n")}`,
    ),
    "请在工作台更新进度；如需延期，请在例会上说明。",
  ].join("\n\n");
}
