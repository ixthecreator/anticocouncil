import { useState } from "react";
import type { Issue, Meeting, WorkspaceData } from "../types";
import { voteTotals } from "../lib/workspace";
import { responsibleName } from "../lib/councilOverview";
import { DeadlineTag, PageLink, StatusTag } from "./CouncilOverview";
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
    <section className="council-proposals">
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
        <ul className="council-proposal-list">
          {list.map((issue) => {
            const meeting = data.meetings.find(
              (meeting) => meeting.id === issue.meetingId,
            );
            const votes = voteTotals(issue);
            return (
              <li className="council-proposal-item" key={issue.id}>
                <article aria-labelledby={`proposal-${issue.id}-title`}>
                  <div className="council-proposal-head">
                    <div className="council-proposal-heading">
                      <p className="council-meta">
                        {issue.serialNumber ? `${issue.serialNumber} · ` : ""}
                        {issue.category}
                      </p>
                      {/* The title is the card's one control that opens the
                          record; the dialog shows and edits it. */}
                      <h2 id={`proposal-${issue.id}-title`}>
                        <button
                          className="council-link"
                          onClick={() => onOpenIssue(issue)}
                        >
                          {issue.title}
                        </button>
                      </h2>
                    </div>
                    <div className="council-tag-group">
                      <StatusTag status={issue.status} />
                      {!issue.archived &&
                        !["completed", "rejected"].includes(issue.status) && (
                          <DeadlineTag dueDate={issue.dueDate} today={today} />
                        )}
                      {issue.archived && (
                        <span className="council-tag grey">已归档</span>
                      )}
                    </div>
                  </div>
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
                          <PageLink
                            page="session"
                            onFollow={() => onOpenMeeting(meeting)}
                          >
                            {meeting.title}
                          </PageLink>
                        ) : (
                          "未关联会议"
                        )}
                      </dd>
                    </div>
                    {issue.dueDate && (
                      <div>
                        <dt>截止日期</dt>
                        <dd>
                          <time dateTime={issue.dueDate}>{issue.dueDate}</time>
                        </dd>
                      </div>
                    )}
                    {issue.status === "voting" && (
                      <div>
                        <dt>当前表决</dt>
                        <dd className="council-proposal-votes">
                          赞成 <strong>{votes.approve}</strong> · 反对{" "}
                          <strong>{votes.reject}</strong> · 弃权{" "}
                          <strong>{votes.abstain}</strong>
                        </dd>
                      </div>
                    )}
                  </dl>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>没有符合条件的议题。切换状态或清除搜索后重试。</Empty>
      )}
    </section>
  );
}
