import { ArrowRight, ArrowUpRight } from "lucide-react";
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
      <div>
        <section
          className="council-meeting-feature"
          aria-labelledby="featured-meeting-title"
        >
          <div className="council-section-kicker">
            <span>
              {featured && featured.date < today ? "最近例会" : "本次例会"}
            </span>
            {featured && (
              <span className="council-tag purple">
                {featured.date === today
                  ? "今日例会"
                  : featured.date > today
                    ? "即将召开"
                    : "查看记录"}
              </span>
            )}
          </div>
          {featured ? (
            <>
              <div className="council-meeting-title-row">
                <div className="council-date-block" aria-hidden="true">
                  <span>{Number(featured.date.slice(5, 7))} 月</span>
                  <strong>{featured.date.slice(8, 10)}</strong>
                  <small>{weekday(featured.date)}</small>
                </div>
                <div>
                  <p className="council-meta">
                    {featured.date} · {featured.week}
                  </p>
                  <h2 id="featured-meeting-title">
                    <button
                      className="council-title-link"
                      onClick={() => onOpenMeeting(featured)}
                    >
                      {featured.title}
                    </button>
                  </h2>
                  <p className="council-meta">
                    {count} 项议题 · {data.members.length} 名登记成员
                  </p>
                </div>
              </div>
              <p className="council-feature-description">
                {featured.summary ||
                  "查阅本次议程，安排每周汇报，并记录讨论与执行分工。"}
              </p>
              <div className="council-feature-bottom">
                <button
                  className="workspace-button primary"
                  onClick={() => onOpenMeeting(featured)}
                >
                  查看议程与汇报 <ArrowRight size={17} aria-hidden="true" />
                </button>
                <span className="council-meta">
                  {weeklyReports(data, featured.date).length} 人安排汇报
                </span>
              </div>
            </>
          ) : (
            <>
              <h2 id="featured-meeting-title">还没有例会</h2>
              <p className="council-feature-description">
                创建第一场例会，开始每周汇报与议程记录。
              </p>
              <button
                className="workspace-button primary"
                onClick={() => onNavigate("session")}
              >
                前往新建例会 <ArrowRight size={17} />
              </button>
            </>
          )}
        </section>
        <section className="council-section">
          <div className="council-section-title">
            <h2>待议事项</h2>
            <button
              className="council-link"
              onClick={() => onNavigate("proposals")}
            >
              全部议题 <ArrowRight size={15} />
            </button>
          </div>
          {filteredAgenda.length ? (
            filteredAgenda.slice(0, 5).map((issue, index) => (
              <article className="council-issue-row" key={issue.id}>
                <span className="council-row-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span
                    className={`council-tag ${issue.status === "voting" ? "blue" : "grey"}`}
                  >
                    {statusLabels[issue.status]}
                  </span>
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
                <ArrowUpRight
                  className="council-row-arrow"
                  size={21}
                  aria-hidden="true"
                />
              </article>
            ))
          ) : (
            <Empty>
              {query
                ? "没有匹配的待议事项。"
                : "当前没有待讨论或表决中的议题。"}
            </Empty>
          )}
        </section>
      </div>
      <aside>
        <section className="council-action-panel">
          <div className="council-section-title">
            <h2>待处理事项</h2>
            <span className="council-number-label">
              {String(filteredActions.length).padStart(2, "0")}
            </span>
          </div>
          {filteredActions.length ? (
            filteredActions.slice(0, 5).map((item) => (
              <button
                className="council-action-item"
                key={item.id}
                onClick={() => {
                  if (item.kind === "editorial") onOpenEditorial(item.title);
                  else {
                    const issue = data.issues.find(
                      (issue) => issue.id === item.recordId,
                    );
                    if (issue) onOpenIssue(issue);
                  }
                }}
              >
                <span className="council-action-heading">
                  <strong>{item.title}</strong>
                  <DeadlineTag dueDate={item.dueDate} today={today} />
                </span>
                <span className="council-meta">{item.description}</span>
                {item.dueDate && (
                  <span className="council-meta">截止 {item.dueDate}</span>
                )}
              </button>
            ))
          ) : (
            <p className="council-empty-note">
              {query ? "没有匹配的待处理事项。" : "暂无待处理事项。"}
            </p>
          )}
          {filteredActions.length > 5 && (
            <p className="council-meta council-spaced">
              显示最早到期的 5 项，其余事项可在执行督办与编辑部查阅。
            </p>
          )}
        </section>
        <section className="council-section council-side-section">
          <h2>工作进展</h2>
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
            className="council-link"
            onClick={() => onNavigate("supervision")}
          >
            查看执行督办 <ArrowRight size={15} />
          </button>
        </section>
        <section className="council-section council-side-section">
          <h2>最近记录</h2>
          {recentRecords.length ? (
            recentRecords.map((meeting) => (
              <div key={meeting.id} className="council-recent-record">
                <p className="council-meta">
                  {meeting.date} · {meeting.week}
                </p>
                <h3>
                  <button
                    className="council-link"
                    onClick={() => onOpenMeeting(meeting)}
                  >
                    {meeting.title}
                  </button>
                </h3>
              </div>
            ))
          ) : (
            <p className="council-meta">尚无已记录内容的会议。</p>
          )}
          <button
            className="council-link council-spaced"
            onClick={() => onNavigate("archive")}
          >
            查阅全部纪要 <ArrowRight size={15} />
          </button>
        </section>
      </aside>
    </div>
  );
}
