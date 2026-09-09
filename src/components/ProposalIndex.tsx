import { useState } from "react";
import type { Issue, Meeting, WorkspaceData } from "../types";
import { statusLabels, voteTotals } from "../lib/workspace";
import { responsibleName } from "../lib/councilOverview";
import { DeadlineTag } from "./CouncilOverview";
import { Empty } from "./WorkspaceForms";

export function ProposalIndex({
  issues,
  data,
  today,
  onOpenIssue,
  onOpenMeeting,
}: {
  issues: Issue[];
  data: WorkspaceData;
  today: string;
  onOpenIssue: (issue: Issue) => void;
  onOpenMeeting: (meeting: Meeting) => void;
}) {
  const [filter, setFilter] = useState("active");
  const list = issues
    .filter(
      (issue) =>
        filter === "all" ||
        (filter === "active"
          ? !issue.archived && ["agenda", "voting"].includes(issue.status)
          : !issue.archived && issue.status === filter),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <section>
      <div className="council-filter-toolbar">
        <label htmlFor="proposal-status">议题状态</label>
        <select
          id="proposal-status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="active">待讨论与表决中</option>
          <option value="voting">表决中</option>
          <option value="agenda">待讨论</option>
          <option value="passed">已通过</option>
          <option value="rejected">已否决</option>
          <option value="all">全部议题（含归档）</option>
        </select>
        <span className="council-meta" role="status">
          {list.length} 项议题
        </span>
      </div>
      {list.length ? (
        list.map((issue) => {
          const meeting = data.meetings.find(
            (meeting) => meeting.id === issue.meetingId,
          );
          const votes = voteTotals(issue);
          return (
            <article className="council-proposal-item" key={issue.id}>
              <div className="council-proposal-meta">
                <span className="council-meta">
                  {issue.serialNumber ? `${issue.serialNumber} · ` : ""}
                  {issue.category}
                </span>
                <div className="council-tag-group">
                  <span
                    className={`council-tag ${issue.status === "voting" ? "blue" : issue.status === "completed" || issue.status === "passed" ? "green" : "grey"}`}
                  >
                    {statusLabels[issue.status]}
                  </span>
                  {!issue.archived &&
                    !["completed", "rejected"].includes(issue.status) && (
                      <DeadlineTag dueDate={issue.dueDate} today={today} />
                    )}
                  {issue.archived && (
                    <span className="council-tag grey">已归档</span>
                  )}
                </div>
              </div>
              <h2>
                <button
                  className="council-link"
                  onClick={() => onOpenIssue(issue)}
                >
                  {issue.title}
                </button>
              </h2>
              <p className="council-proposal-description">
                {issue.description || "尚未填写议题背景。"}
              </p>
              <dl className="council-proposal-facts">
                <div>
                  <dt>负责人</dt>
                  <dd>{responsibleName(issue, data)}</dd>
                </div>
                <div>
                  <dt>所属会议</dt>
                  <dd>
                    {meeting ? (
                      <button
                        className="council-link"
                        onClick={() => onOpenMeeting(meeting)}
                      >
                        {meeting.title}
                      </button>
                    ) : (
                      "未关联会议"
                    )}
                  </dd>
                </div>
                {issue.dueDate && (
                  <div>
                    <dt>截止日期</dt>
                    <dd>{issue.dueDate}</dd>
                  </div>
                )}
              </dl>
              {issue.status === "voting" && (
                <p className="council-meta">
                  当前表决：赞成 {votes.approve} · 反对 {votes.reject} · 弃权{" "}
                  {votes.abstain}
                </p>
              )}
              <div className="workspace-actions council-spaced">
                <button
                  className="workspace-button"
                  onClick={() => onOpenIssue(issue)}
                >
                  查看与编辑议题
                </button>
                {issue.status === "voting" && !issue.archived && meeting && (
                  <button
                    className="workspace-button primary"
                    onClick={() => onOpenMeeting(meeting)}
                  >
                    查看所属例会
                  </button>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <Empty>没有符合条件的议题。切换状态或清除搜索后重试。</Empty>
      )}
    </section>
  );
}
