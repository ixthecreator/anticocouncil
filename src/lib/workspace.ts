import type { Attendance, Issue, WorkspaceData } from "../types";

export const collectionNames = [
  "meetings",
  "issues",
  "members",
  "activities",
  "attendance",
  "editorial",
  "assets",
  "inventory",
] as const;
export type CollectionName = (typeof collectionNames)[number];
export const emptyWorkspace = (): WorkspaceData => ({
  meetings: [],
  issues: [],
  members: [],
  activities: [],
  attendance: [],
  editorial: [],
  assets: [],
  inventory: [],
});
export const statusLabels: Record<Issue["status"], string> = {
  agenda: "待讨论",
  voting: "表决中",
  passed: "已通过",
  rejected: "已否决",
  authorization: "待执行",
  execution: "执行中",
  completed: "已完成",
};
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const weekday = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", {
        weekday: "long",
      })
    : "";
export const voteTotals = (issue: Issue) =>
  issue.voteMode === "members"
    ? Object.values(issue.ballots || {}).reduce(
        (totals, vote) => {
          totals[vote]++;
          return totals;
        },
        { approve: 0, reject: 0, abstain: 0 },
      )
    : issue.votes || { approve: 0, reject: 0, abstain: 0 };
export function votingResult(issue: Issue): "passed" | "rejected" {
  const { approve, reject, abstain } = voteTotals(issue);
  return (
    issue.voteRule === "absolute"
      ? approve > (approve + reject + abstain) / 2
      : approve > reject
  )
    ? "passed"
    : "rejected";
}
export function recordBallot(
  issue: Issue,
  memberId: string,
  choice: "approve" | "reject" | "abstain",
): Issue {
  if (issue.status !== "voting" || issue.voteMode !== "members")
    throw new Error("表决已结束或尚未开启，请刷新后重试。");
  if (!memberId) throw new Error("请先选择签到成员。");
  return {
    ...issue,
    ballots: { ...issue.ballots, [memberId]: choice },
    updatedAt: new Date().toISOString(),
  };
}

export function advanceIssue(
  issue: Issue,
  expected: Issue["status"],
  next: Issue["status"],
): Issue {
  if (issue.status !== expected)
    throw new Error("议题状态已改变，请刷新后重试。");
  return { ...issue, status: next, updatedAt: new Date().toISOString() };
}
export function latestReport(
  records: Attendance[],
  memberId: string,
  meetingId: string,
  meetingDate: string,
  data: WorkspaceData,
) {
  return records
    .filter(
      (r) =>
        r.memberId === memberId &&
        r.meetingId !== meetingId &&
        r.reportStatus === "reported" &&
        (data.meetings.find((m) => m.id === r.meetingId)?.date || "9999") <=
          meetingDate,
    )
    .sort((a, b) =>
      (
        data.meetings.find((m) => m.id === b.meetingId)?.date || ""
      ).localeCompare(
        data.meetings.find((m) => m.id === a.meetingId)?.date || "",
      ),
    )[0];
}
export function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
const required: Record<CollectionName, string[]> = {
  meetings: ["title", "date", "week", "summary", "createdAt"],
  issues: [
    "title",
    "category",
    "priority",
    "status",
    "description",
    "discussion",
    "signature",
    "createdAt",
    "updatedAt",
  ],
  members: ["name", "role", "avatarSymbol"],
  activities: ["name", "time", "organizer", "participants"],
  attendance: [
    "meetingId",
    "memberId",
    "memberName",
    "checkedInAt",
    "reportStatus",
    "reportNote",
  ],
  editorial: [
    "title",
    "department",
    "author",
    "editor",
    "designer",
    "dueDate",
    "status",
    "notes",
  ],
  assets: [
    "title",
    "kind",
    "author",
    "tags",
    "url",
    "fileName",
    "fileData",
    "notes",
    "updatedAt",
  ],
  inventory: ["title", "location", "keeper", "notes"],
};
export function parseBackup(value: unknown): Partial<WorkspaceData> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("备份必须是 JSON 对象。");
  const result: Partial<WorkspaceData> = {};
  for (const key of collectionNames) {
    if (!(key in value)) continue;
    const rows = (value as Record<string, unknown>)[key];
    if (!Array.isArray(rows)) throw new Error(`${key} 必须是列表。`);
    const ids = new Set<string>();
    for (const row of rows) {
      if (
        !row ||
        typeof row.id !== "string" ||
        !row.id ||
        row.id.includes("/") ||
        ["__proto__", "constructor", "prototype"].includes(row.id) ||
        ids.has(row.id)
      )
        throw new Error(`${key} 包含无效或重复编号。`);
      ids.add(row.id);
      if (required[key].some((field) => typeof row[field] !== "string"))
        throw new Error(`${key} 存在缺失或无效字段。`);
      const optionalStrings: Record<CollectionName, string[]> = {
        meetings: ["regularReport"],
        issues: ["dueDate", "archivedAt", "serialNumber"],
        activities: ["location", "description"],
        members: [],
        attendance: ["reportedAt"],
        editorial: [],
        assets: [],
        inventory: [],
      };
      if (
        optionalStrings[key].some(
          (field) => row[field] !== undefined && typeof row[field] !== "string",
        )
      )
        throw new Error(`${key} 包含无效文本字段。`);
      if (
        key === "meetings" &&
        (!Array.isArray(row.issueIds) ||
          row.issueIds.some((id) => typeof id !== "string") ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.date))
      )
        throw new Error("会议日期或议题列表无效。");
      if (
        key === "attendance" &&
        !["pending", "reported", "exempt"].includes(row.reportStatus)
      )
        throw new Error("汇报状态无效。");
      if (
        key === "editorial" &&
        (!["微信编辑部", "QQ编辑部"].includes(row.department) ||
          !["选题", "撰稿", "编辑", "排版", "已发布"].includes(row.status))
      )
        throw new Error("编辑安排格式无效。");
      if (
        key === "assets" &&
        !["作者名片", "美工素材", "往期成果"].includes(row.kind)
      )
        throw new Error("资料类型无效。");
      if (
        key === "activities" &&
        row.status !== undefined &&
        !["planned", "completed", "cancelled"].includes(row.status)
      )
        throw new Error("活动状态无效。");
      if (
        key === "issues" &&
        ((row.voteMode !== undefined &&
          !["manual", "members"].includes(row.voteMode)) ||
          (row.voteRule !== undefined &&
            !["simple", "absolute"].includes(row.voteRule)))
      )
        throw new Error("投票模式无效。");
      if (
        key === "issues" &&
        row.votes !== undefined &&
        (!row.votes ||
          typeof row.votes !== "object" ||
          ["approve", "reject", "abstain"].some(
            (v) => !Number.isSafeInteger(row.votes[v]) || row.votes[v] < 0,
          ))
      )
        throw new Error("票数必须是非负整数。");
      if (
        key === "issues" &&
        (!Object.hasOwn(statusLabels, row.status) ||
          !["low", "medium", "high", "urgent"].includes(row.priority) ||
          typeof row.archived !== "boolean" ||
          (row.meetingId !== null && typeof row.meetingId !== "string"))
      )
        throw new Error("议题格式无效。");
      if (
        key === "issues" &&
        row.ballots &&
        (typeof row.ballots !== "object" ||
          Object.values(row.ballots).some(
            (v) => !["approve", "reject", "abstain"].includes(v as string),
          ))
      )
        throw new Error("投票记录无效。");
      if (
        key === "inventory" &&
        (!Number.isSafeInteger(row.quantity) || row.quantity < 0)
      )
        throw new Error("库存数量必须是非负整数。");
      if (
        key === "assets" &&
        ((row.url && !safeUrl(row.url)) ||
          (row.fileData &&
            !/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(
              row.fileData,
            )) ||
          row.fileData.length > 550000)
      )
        throw new Error("资料文件或链接无效。");
    }
    (result as Record<string, unknown>)[key] = rows;
  }
  if (!Object.keys(result).length) throw new Error("未找到可导入的数据。");
  return result;
}

export function meetingBrief(data: WorkspaceData, meetingId: string) {
  const meeting = data.meetings.find((m) => m.id === meetingId);
  if (!meeting) return "";
  const attendance = data.attendance
    .filter((r) => r.meetingId === meetingId)
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  const issues = data.issues.filter((i) => i.meetingId === meetingId);
  return [
    `${meeting.title}\n${meeting.date} ${meeting.week}`,
    `会议记录\n${meeting.regularReport || "暂无记录"}`,
    `会议摘要\n${meeting.summary || "暂无摘要"}`,
    `签到与汇报（${attendance.length} 人）\n${attendance.map((r, i) => `${i + 1}. ${r.memberName}｜${{ pending: "待汇报", reported: "已汇报", exempt: "本次免汇报" }[r.reportStatus]}｜${r.reportNote}`).join("\n") || "暂无签到"}`,
    `议程与执行\n${
      issues
        .map((i, n) => {
          const votes = voteTotals(i);
          return `${n + 1}. ${i.title}｜${statusLabels[i.status]}\n负责人：${i.signature || "待安排"}　截止：${i.dueDate || "未设定"}\n${i.description}\n结论与执行记录：${i.discussion || "暂无"}${i.votes || i.ballots ? `\n表决：赞成 ${votes.approve} / 反对 ${votes.reject} / 弃权 ${votes.abstain}` : ""}`;
        })
        .join("\n\n") || "暂无议题"
    }`,
  ].join("\n\n");
}
export function downloadText(
  text: string,
  filename: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
