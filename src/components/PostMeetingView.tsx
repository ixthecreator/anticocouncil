import { Action } from "./WorkspaceForms";
import React, { useState } from "react";
import { Issue, Status, Member } from "../types";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DeadlineTag } from "./CouncilOverview";
import { localDate } from "../lib/workspace";

interface PostMeetingViewProps {
  issues: Issue[];
  members: Member[];
  onUpdateIssue: (issue: Issue) => Promise<unknown>;
  onOpenDetail: (issue: Issue) => void;
}

/* Priority is shown as a text tag; the colour only supports the word. */
const priorityTags: Record<Issue["priority"], { text: string; tone: string }> =
  {
    urgent: { text: "紧急", tone: "red" },
    high: { text: "高优先级", tone: "amber" },
    medium: { text: "中优先级", tone: "grey" },
    low: { text: "低优先级", tone: "grey" },
  };

export const PostMeetingView: React.FC<PostMeetingViewProps> = ({
  issues,
  members,
  onUpdateIssue,
  onOpenDetail,
}) => {
  const postMeetingStatuses: Status[] = [
    "passed",
    "authorization",
    "execution",
  ];
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(
    new Set(),
  );
  const today = localDate();

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIssueIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getIssuesByStatus = (status: Status) => {
    return issues.filter((i) => i.status === status && !i.archived);
  };

  const getStatusTitle = (status: Status) => {
    switch (status) {
      case "passed":
        return "等待授权";
      case "authorization":
        return "待下发执行";
      case "execution":
        return "执行中";
      case "completed":
        return "归档完成";
      default:
        return status;
    }
  };

  const responsibleName = (issue: Issue) =>
    members.find((member) => member.id === issue.signature)?.name ||
    issue.signature ||
    "待安排";

  const handleStatusChange = (issue: Issue, newStatus: Status) => {
    return onUpdateIssue({ ...issue, status: newStatus });
  };

  return (
    <div className="execution-board">
      {postMeetingStatuses.map((status) => {
        const title = getStatusTitle(status);
        const columnIssues = getIssuesByStatus(status);
        const headingId = `execution-column-${status}`;

        return (
          <section
            key={status}
            className="execution-column"
            aria-labelledby={headingId}
          >
            <h2 id={headingId} className="execution-column-heading">
              {title}
              <small className="execution-column-count">
                {columnIssues.length} 项
              </small>
            </h2>

            {columnIssues.length === 0 ? (
              <p className="execution-column-empty">无相关议案</p>
            ) : (
              <ul className="execution-cards">
                {columnIssues.map((issue) => {
                  const isExpanded = expandedIssueIds.has(issue.id);
                  const isExecution = status === "execution";
                  const detailsId = `execution-details-${issue.id}`;
                  const priority =
                    priorityTags[issue.priority] || priorityTags.low;
                  /* The reference number sits in the meta line, never in
                     the title link (as on the proposal cards). */
                  const meta = [issue.serialNumber, issue.category]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={issue.id}
                      className="execution-card"
                      onClick={() => onOpenDetail(issue)}
                    >
                      {/* The column heading already names the status, so
                          the card only tags its priority. */}
                      <p className="execution-card-tags">
                        <span className={`council-tag ${priority.tone}`}>
                          {priority.text}
                        </span>
                      </p>

                      {meta && <p className="execution-card-meta-line">{meta}</p>}

                      <h3 className="execution-card-title">
                        <button
                          type="button"
                          className="council-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenDetail(issue);
                          }}
                        >
                          {issue.title}
                        </button>
                      </h3>

                      <dl className="execution-card-meta">
                        <div>
                          <dt>负责人</dt>
                          <dd>{responsibleName(issue)}</dd>
                        </div>
                        <div>
                          <dt>截止日期</dt>
                          <dd>
                            <span>{issue.dueDate || "未设置"}</span>
                            <DeadlineTag dueDate={issue.dueDate} today={today} />
                          </dd>
                        </div>
                        <div>
                          <dt>提出日期</dt>
                          <dd>{issue.createdAt.slice(0, 10)}</dd>
                        </div>
                      </dl>

                      {isExecution && (
                        <div
                          className="execution-card-more"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(issue.id, e)}
                            className="workspace-button subtle execution-card-toggle"
                            aria-expanded={isExpanded}
                            aria-controls={isExpanded ? detailsId : undefined}
                          >
                            {isExpanded ? (
                              <ChevronUp aria-hidden="true" />
                            ) : (
                              <ChevronDown aria-hidden="true" />
                            )}
                            {isExpanded ? "收起详情" : "展示更多"}
                          </button>

                          {isExpanded && (
                            <div
                              id={detailsId}
                              className="execution-card-details"
                            >
                              {issue.description && (
                                <>
                                  <h4>议案描述</h4>
                                  <p>{issue.description}</p>
                                </>
                              )}
                              {issue.discussion && (
                                <>
                                  <h4>讨论与附注</h4>
                                  <p>{issue.discussion}</p>
                                </>
                              )}
                              {!issue.description && !issue.discussion && (
                                <p className="council-meta">
                                  暂无描述或附注。
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick Move Actions */}
                      <div
                        className="execution-card-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {status === "passed" && (
                          <Action
                            onClick={() =>
                              handleStatusChange(issue, "authorization")
                            }
                          >
                            移交授权
                          </Action>
                        )}
                        {status === "authorization" && (
                          <Action
                            onClick={() =>
                              handleStatusChange(issue, "execution")
                            }
                          >
                            下发执行
                          </Action>
                        )}
                        {status === "execution" && (
                          <Action
                            onClick={() =>
                              handleStatusChange(issue, "completed")
                            }
                          >
                            标记完成
                          </Action>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
