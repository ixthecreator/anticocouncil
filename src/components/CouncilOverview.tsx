import { ArrowRight } from "lucide-react";
import type { Issue, Meeting, WorkspaceData } from "../types";
import type { WorkspacePage } from "../lib/workspaceNavigation";
import {
  deadlineLabel,
  overviewData,
  responsibleName,
} from "../lib/councilOverview";
import { statusLabels, weekday, weeklyReports } from "../lib/workspace";
import { Empty } from "./WorkspaceForms";

export function DeadlineTag({
  dueDate,
  today,
}: {
  dueDate?: string;
  today: string;
}) {
  const label = deadlineLabel(dueDate, today);
  return label ? (
    <span className={`council-tag ${label.tone}`}>{label.text}</span>
  ) : null;
}

/* Tag colours support the text label; they never carry the status alone. */
const statusTone: Record<Issue["status"], string> = {
  agenda: "grey",
  voting: "blue",
  passed: "green",
  rejected: "red",
  authorization: "purple",
  execution: "purple",
  completed: "green",
};

export function StatusTag({ status }: { status: Issue["status"] }) {
  return (
    <span className={`council-tag ${statusTone[status] || "grey"}`}>
      {statusLabels[status] || status}
    </span>
  );
}

/* "2026-10-24" → "10月24日 星期六". */
function meetingDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日 ${weekday(date)}`;
}

export function CouncilOverview({
  data,
  today,
  search,
  onNavigate,
  onOpenMeeting,
  onOpenIssue,
  onOpenEditorial,
}: {
  data: WorkspaceData;
  today: string;
  search: string;
  onNavigate: (page: WorkspacePage) => void;
  onOpenMeeting: (meeting: Meeting) => void;
  onOpenIssue: (issue: Issue) => void;
  onOpenEditorial: (title: string) => void;
}) {
  const {
    featured,
    agenda,
    actions,
    executionCount,
    completed,
    recentRecords,
  } = overviewData(data, today);
  const query = search.trim().toLocaleLowerCase();
  const filteredAgenda = agenda.filter((issue) =>
    [
      issue.title,
      issue.description,
      issue.category,
      responsibleName(issue, data),
    ].some((text) => text.toLocaleLowerCase().includes(query)),
  );
  const filteredActions = actions.filter((item) =>
    `${item.title} ${item.description}`.toLocaleLowerCase().includes(query),
  );
  const count = featured
    ? data.issues.filter(
        (issue) => issue.meetingId === featured.id && !issue.archived,
      ).length
    : 0;
  return (
    <div className="council-overview-grid">
      <div className="council-overview-main">
        <section
          className="council-meeting-feature"
          aria-labelledby="featured-meeting-title"
        >
          {featured ? (
            <>
              <div className="council-feature-top">
                <p className="council-feature-label">
                  {featured.date < today ? "最近例会" : "本次例会"}
                </p>
                <span className="council-tag purple">
                  {featured.date === today
                    ? "今日例会"
                    : featured.date > today
                      ? "即将召开"
                      : "已召开"}
                </span>
              </div>
              <p className="council-feature-date">
                <time dateTime={featured.date}>{meetingDay(featured.date)}</time>
              </p>
              <h2 id="featured-meeting-title" className="council-feature-title">
                <button
                  className="council-link"
                  onClick={() => onOpenMeeting(featured)}
                >
                  {featured.title}
                </button>
              </h2>
              <p className="council-meta">
                {featured.week ? `${featured.week} · ` : ""}
                {count} 项议题 · {data.members.length} 名登记成员 ·{" "}
                {weeklyReports(data, featured.date).length} 人安排汇报
              </p>
              <p className="council-feature-description">
                {featured.summary ||
                  "查阅本次议程，安排每周汇报，并记录讨论与执行分工。"}
              </p>
              <div className="workspace-actions">
                <button
                  className="workspace-button primary"
                  onClick={() => onOpenMeeting(featured)}
                >
                  查看议程与汇报 <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="council-feature-label">本次例会</p>
              <h2 id="featured-meeting-title" className="council-feature-title">
                还没有例会
              </h2>
              <p className="council-feature-description">
                创建第一场例会，开始每周汇报与议程记录。
              </p>
              <div className="workspace-actions">
                <button
                  className="workspace-button primary"
                  onClick={() => onNavigate("session")}
                >
                  新建例会 <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </section>

        <section
          className="council-widget"
          aria-labelledby="overview-agenda-title"
        >
          <div className="council-widget-heading">
            <h2 id="overview-agenda-title">待议事项</h2>
            <button
              className="council-link council-more-link"
              onClick={() => onNavigate("proposals")}
            >
              全部议题 <ArrowRight aria-hidden="true" />
            </button>
          </div>
          {filteredAgenda.length ? (
            <ul className="council-row-list">
              {filteredAgenda.slice(0, 5).map((issue) => (
                <li className="council-issue-row" key={issue.id}>
                  <div className="council-issue-row-text">
                    <h3>
                      <button
                        className="council-link"
                        onClick={() => onOpenIssue(issue)}
                      >
                        {issue.title}
                      </button>
                    </h3>
                    <p className="council-meta">
                      {issue.category}
                      {issue.dueDate ? ` · 截止 ${issue.dueDate}` : ""}
                    </p>
                  </div>
                  <StatusTag status={issue.status} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              {query
                ? "没有匹配的待议事项。"
                : "当前没有待讨论或表决中的议题。"}
            </Empty>
          )}
        </section>
      </div>

      <aside className="council-overview-side" aria-label="待办与进展">
        <section
          className="council-widget"
          aria-labelledby="overview-actions-title"
        >
          <div className="council-widget-heading">
            <h2 id="overview-actions-title">待处理事项</h2>
            <p className="council-widget-count">
              <strong>{filteredActions.length}</strong> 项
            </p>
          </div>
          {filteredActions.length ? (
            <ul className="council-row-list">
              {filteredActions.slice(0, 5).map((item) => (
                <li className="council-action-item" key={item.id}>
                  <h3>
                    <button
                      className="council-link"
                      onClick={() => {
                        if (item.kind === "editorial")
                          onOpenEditorial(item.title);
                        else {
                          const issue = data.issues.find(
                            (issue) => issue.id === item.recordId,
                          );
                          if (issue) onOpenIssue(issue);
                        }
                      }}
                    >
                      {item.title}
                    </button>
                  </h3>
                  <p className="council-meta">{item.description}</p>
                  {item.dueDate && (
                    <p className="council-meta council-action-due">
                      <span>截止 {item.dueDate}</span>
                      <DeadlineTag dueDate={item.dueDate} today={today} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              {query ? "没有匹配的待处理事项。" : "暂无待处理事项。"}
            </Empty>
          )}
          {filteredActions.length > 5 && (
            <p className="council-meta council-widget-note">
              显示最早到期的 5 项，其余事项可在执行督办与编辑部查阅。
            </p>
          )}
        </section>

        <section
          className="council-widget"
          aria-labelledby="overview-progress-title"
        >
          <h2 id="overview-progress-title">工作进展</h2>
          <div className="council-progress-line">
            <span>全部执行事项</span>
            <strong>
              {completed} / {executionCount} 已完成
            </strong>
          </div>
          <progress
            className="council-progress"
            max={Math.max(executionCount, 1)}
            value={completed}
            aria-label={`执行事项已完成 ${completed} 项，共 ${executionCount} 项`}
          />
          <button
            className="council-link council-more-link"
            onClick={() => onNavigate("supervision")}
          >
            查看执行督办 <ArrowRight aria-hidden="true" />
          </button>
        </section>

        <section
          className="council-widget"
          aria-labelledby="overview-records-title"
        >
          <h2 id="overview-records-title">最近记录</h2>
          {recentRecords.length ? (
            <ul className="council-row-list">
              {recentRecords.map((meeting) => (
                <li key={meeting.id} className="council-recent-record">
                  <h3>
                    <button
                      className="council-link"
                      onClick={() => onOpenMeeting(meeting)}
                    >
                      {meeting.title}
                    </button>
                  </h3>
                  <p className="council-meta">
                    <time dateTime={meeting.date}>{meeting.date}</time>
                    {meeting.week ? ` · ${meeting.week}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>尚无已记录内容的会议。</Empty>
          )}
          <button
            className="council-link council-more-link"
            onClick={() => onNavigate("archive")}
          >
            查阅全部纪要 <ArrowRight aria-hidden="true" />
          </button>
        </section>
      </aside>
    </div>
  );
}
