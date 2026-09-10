import { useState } from "react";
import type { Meeting, Issue, Member } from "../types";
import { localDate, statusLabels } from "../lib/workspace";
import { DeadlineTag } from "./CouncilOverview";
import { Empty } from "./WorkspaceForms";

interface SupervisionViewProps {
  meetings: Meeting[];
  issues: Issue[];
  members?: Member[];
  onOpenDetail: (issue: Issue) => void;
}

export function SupervisionView({
  meetings,
  issues,
  members = [],
  onOpenDetail,
}: SupervisionViewProps) {
  const [scope, setScope] = useState<"current" | "overview">("current");
  const [recentN, setRecentN] = useState(3);
  const current = issues.filter((issue) =>
    ["passed", "authorization", "execution"].includes(issue.status),
  );
  const recentMeetings = [...meetings]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, recentN);
  const recentIds = new Set(recentMeetings.map((meeting) => meeting.id));
  const records = (
    scope === "current"
      ? current
      : issues.filter(
          (issue) =>
            recentIds.has(issue.meetingId || "") &&
            ["passed", "authorization", "execution", "completed"].includes(
              issue.status,
            ),
        )
  ).sort(
    (a, b) =>
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const today = localDate();

  return (
    <section aria-label="执行事项">
      <div className="council-stat-strip">
        <div>
          <strong>
            {current.filter((issue) => issue.status !== "execution").length}
          </strong>
          <span>待授权 / 待执行</span>
        </div>
        <div>
          <strong>
            {current.filter((issue) => issue.status === "execution").length}
          </strong>
          <span>执行中</span>
        </div>
        <div>
          <strong>
            {issues.filter((issue) => issue.status === "completed").length}
          </strong>
          <span>已完成</span>
        </div>
      </div>
      <div className="council-filter-toolbar">
        <label htmlFor="supervision-scope">查看范围</label>
        <select
          id="supervision-scope"
          value={scope}
          onChange={(event) => setScope(event.target.value as typeof scope)}
        >
          <option value="current">待完成事项</option>
          <option value="overview">按近期会议回顾</option>
        </select>
        {scope === "overview" && (
          <label className="council-recent-count">
            最近
            <input
              aria-label="回顾会议数量"
              type="number"
              min="1"
              max="20"
              value={recentN}
              onChange={(event) =>
                setRecentN(
                  Math.min(
                    20,
                    Math.max(1, Math.floor(Number(event.target.value)) || 1),
                  ),
                )
              }
            />
            次会议
          </label>
        )}
        <span>{records.length} 项事项</span>
      </div>
      {records.length === 0 ? (
        <Empty>
          {scope === "current"
            ? "目前没有待授权或执行中的事项。"
            : "所选会议中暂无通过的事项。"}
        </Empty>
      ) : (
        <div className="council-table-wrap">
          <table className="council-table">
            <caption className="sr-only">
              {scope === "current"
                ? "待完成的执行事项"
                : `最近 ${recentN} 次会议的执行记录`}
            </caption>
            <thead>
              <tr>
                <th scope="col">执行事项</th>
                <th scope="col">负责人</th>
                <th scope="col">截止日期</th>
                <th scope="col">状态</th>
                <th scope="col">
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((issue) => {
                const meeting = meetings.find(
                  (item) => item.id === issue.meetingId,
                );
                const responsible =
                  members.find((member) => member.id === issue.signature)
                    ?.name ||
                  issue.signature ||
                  "待安排";
                return (
                  <tr key={issue.id}>
                    <th scope="row">
                      <button
                        className="council-link"
                        onClick={() => onOpenDetail(issue)}
                      >
                        {issue.serialNumber ? `${issue.serialNumber} · ` : ""}
                        {issue.title}
                      </button>
                      <p className="council-meta">
                        {issue.category}
                        {meeting ? ` · ${meeting.title}` : ""}
                      </p>
                    </th>
                    <td>{responsible}</td>
                    <td>
                      <div className="council-due-date">
                        <span>{issue.dueDate || "未设置"}</span>
                        {!issue.archived && issue.status !== "completed" && (
                          <DeadlineTag dueDate={issue.dueDate} today={today} />
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`council-tag ${issue.status === "completed" ? "green" : issue.status === "execution" ? "blue" : "grey"}`}
                      >
                        {statusLabels[issue.status]}
                      </span>
                      {issue.archived && <p className="council-meta">已归档</p>}
                    </td>
                    <td>
                      <button
                        className="council-link council-nowrap"
                        onClick={() => onOpenDetail(issue)}
                        aria-label={`查看与更新：${issue.title}`}
                      >
                        查看与更新
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
