import type { Issue, Meeting, WorkspaceData } from "../types";

export function deadlineLabel(dueDate: string | undefined, today: string) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const date = new Date(`${dueDate}T12:00:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== Number(dueDate.slice(0, 4)) ||
    date.getMonth() + 1 !== Number(dueDate.slice(5, 7)) ||
    date.getDate() !== Number(dueDate.slice(8, 10))
  )
    return null;
  if (dueDate === today) return { text: "今日截止", tone: "amber" } as const;
  if (dueDate < today) return { text: "已逾期", tone: "red" } as const;
  return null;
}

export function featuredMeeting(meetings: Meeting[], today: string) {
  const upcoming = meetings
    .filter((meeting) => meeting.date >= today)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
  return (
    upcoming[0] ||
    [...meetings].sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )[0] ||
    null
  );
}

export function responsibleName(issue: Issue, data: WorkspaceData) {
  return (
    data.members.find((member) => member.id === issue.signature)?.name ||
    issue.signature ||
    "待安排负责人"
  );
}

export function overviewData(data: WorkspaceData, today: string) {
  const activeIssues = data.issues.filter((issue) => !issue.archived);
  const agenda = activeIssues
    .filter((issue) => issue.status === "voting" || issue.status === "agenda")
    .sort(
      (a, b) =>
        Number(b.status === "voting") - Number(a.status === "voting") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const actions = [
    ...activeIssues
      .filter((issue) =>
        ["voting", "passed", "authorization", "execution"].includes(
          issue.status,
        ),
      )
      .map((issue) => ({
        id: `issue-${issue.id}`,
        kind: "issue" as const,
        recordId: issue.id,
        title: issue.title,
        dueDate: issue.dueDate || "",
        description: `${issue.category} · ${responsibleName(issue, data)}`,
      })),
    ...data.editorial
      .filter((item) => item.status !== "已发布")
      .map((item) => ({
        id: `editorial-${item.id}`,
        kind: "editorial" as const,
        recordId: item.id,
        title: item.title,
        dueDate: item.dueDate,
        description: `${item.department} · ${item.editor || "待安排编辑"}`,
      })),
  ].sort(
    (a, b) =>
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      a.title.localeCompare(b.title),
  );
  const execution = data.issues.filter((issue) =>
    ["passed", "authorization", "execution", "completed"].includes(
      issue.status,
    ),
  );
  const completed = execution.filter(
    (issue) => issue.status === "completed",
  ).length;
  const recentRecords = [...data.meetings]
    .filter(
      (meeting) =>
        meeting.date <= today &&
        (meeting.summary ||
          meeting.regularReport ||
          data.issues.some(
            (issue) => issue.meetingId === meeting.id && issue.archived,
          )),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 2);
  return {
    featured: featuredMeeting(data.meetings, today),
    agenda,
    actions,
    executionCount: execution.length,
    completed,
    recentRecords,
  };
}
