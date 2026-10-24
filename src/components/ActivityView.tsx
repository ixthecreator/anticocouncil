import { useId, useRef, useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import type { ActivityEvent } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import { localDate, safeUrl } from "../lib/workspace";
import { Empty, Field, SaveForm } from "./WorkspaceForms";
import { DeleteButton, useInlineFormFocus } from "./OperationsView";

const STATUS: Record<
  NonNullable<ActivityEvent["status"]>,
  { label: string; tone: string }
> = {
  planned: { label: "计划中", tone: "blue" },
  completed: { label: "已结束", tone: "grey" },
  cancelled: { label: "已取消", tone: "red" },
};
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** "2026-10" → "2026年10月". */
function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${Number(year)}年${Number(month)}月`;
}

/** Splits "2026-11-01T14:00" into "2026年11月", "11月1日 周六" and "14:00". */
function eventDate(time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(time);
  if (!match) return { month: "日期待定", day: time || "日期待定", clock: "" };
  const [, year, month, day, clock = ""] = match;
  const weekday =
    WEEKDAYS[new Date(Number(year), Number(month) - 1, Number(day)).getDay()];
  return {
    month: `${Number(year)}年${Number(month)}月`,
    day: `${Number(month)}月${Number(day)}日 ${weekday ?? ""}`.trim(),
    clock,
  };
}

export function ActivityView({
  workspace,
  search,
}: {
  workspace: Workspace;
  search: string;
}) {
  const [month, setMonth] = useState("");
  const [editing, setEditing] = useState<ActivityEvent | null>(null);
  const form = useInlineFormFocus(editing?.id);
  const formId = useId();
  const monthId = useId();
  const results = useRef<HTMLParagraphElement>(null);
  const adding =
    !!editing && !workspace.data.activities.some((a) => a.id === editing.id);
  const close = () => {
    setEditing(null);
    form.restore();
  };
  const rows = workspace.data.activities
    .filter(
      (a) =>
        (!month || a.time.startsWith(month)) &&
        [
          a.name,
          a.time,
          a.organizer,
          a.participants,
          a.description,
          a.location,
        ].some((value) => value?.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  // The month filter offers the months that have events, and keeps the
  // chosen month listed even if its last event is deleted.
  const months = [
    ...new Set(
      workspace.data.activities
        .map((a) => /^\d{4}-\d{2}/.exec(a.time)?.[0] ?? "")
        .concat(month)
        .filter(Boolean),
    ),
  ].sort();
  // Consecutive rows of the same month form one group under a month heading.
  const groups: { month: string; rows: ActivityEvent[] }[] = [];
  for (const row of rows) {
    const month = eventDate(row.time).month;
    const last = groups[groups.length - 1];
    if (last?.month === month) last.rows.push(row);
    else groups.push({ month, rows: [row] });
  }
  return (
    <div className="daily-view activity-view">
      <div className="daily-actions">
        <button
          type="button"
          className={`workspace-button${editing ? "" : " primary"}`}
          aria-expanded={adding}
          aria-controls={adding ? formId : undefined}
          onClick={(event) => {
            if (adding) return close();
            form.remember(event.currentTarget);
            setEditing({
              id: crypto.randomUUID(),
              time: `${localDate()}T19:00`,
              name: "",
              organizer: "",
              participants: "",
              location: "",
              description: "",
              status: "planned",
            });
          }}
        >
          {adding ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {adding ? "收起" : "新增活动"}
        </button>
        <a
          className="council-link daily-related"
          target="_blank"
          rel="noreferrer"
          href="https://docs.qq.com/sheet/DSm5ubnNnSktMY2R5?tab=BB08J2"
        >
          原月度安排表
          <ExternalLink aria-hidden="true" />
          <span className="ac-visually-hidden">（在新窗口打开）</span>
        </a>
      </div>
      {editing && (
        <div id={formId} className="daily-form">
          <SaveForm
            key={editing.id}
            onCancel={close}
            onSave={async () => {
              if (!editing.name.trim()) throw new Error("请输入活动主题。");
              await workspace.save("activities", {
                ...editing,
                name: editing.name.trim(),
              });
              close();
            }}
          >
            <h2 ref={form.heading} tabIndex={-1} className="daily-form-title">
              {adding ? "新增活动" : "编辑活动"}
            </h2>
            <Field label="沙龙主题">
              <input
                required
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </Field>
            <Field label="活动时间（北京时间）">
              <input
                required
                type="datetime-local"
                value={editing.time.replace(" ", "T")}
                onChange={(e) =>
                  setEditing({ ...editing, time: e.target.value })
                }
              />
            </Field>
            <Field label="举办者">
              <input
                value={editing.organizer}
                onChange={(e) =>
                  setEditing({ ...editing, organizer: e.target.value })
                }
              />
            </Field>
            <Field label="参与或协助组织">
              <input
                value={editing.participants}
                onChange={(e) =>
                  setEditing({ ...editing, participants: e.target.value })
                }
              />
            </Field>
            <Field label="线上会议链接或地点">
              <input
                value={editing.location || ""}
                onChange={(e) =>
                  setEditing({ ...editing, location: e.target.value })
                }
              />
            </Field>
            <Field label="活动状态">
              <select
                value={editing.status || "planned"}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    status: e.target.value as ActivityEvent["status"],
                  })
                }
              >
                <option value="planned">计划中</option>
                <option value="completed">已结束</option>
                <option value="cancelled">已取消</option>
              </select>
            </Field>
            <Field label="活动安排与备注">
              <textarea
                rows={3}
                value={editing.description || ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Field>
          </SaveForm>
        </div>
      )}
      <div className="council-filter-toolbar daily-toolbar">
        <label htmlFor={monthId}>筛选月份</label>
        <select
          id={monthId}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option value="">全部月份</option>
          {months.map((value) => (
            <option key={value} value={value}>
              {monthLabel(value)}
            </option>
          ))}
        </select>
        <p ref={results} tabIndex={-1} className="council-meta" role="status">
          {rows.length} 场活动
        </p>
      </div>
      {!rows.length ? (
        <Empty>
          {month || search
            ? "当前月份或搜索条件下没有活动。"
            : "尚无沙龙安排，添加主题和时间开始排期。"}
        </Empty>
      ) : (
        groups.map((group) => (
          <div key={group.month} className="activity-month">
            <h2>{group.month}</h2>
            <ol className="activity-list">
              {group.rows.map((row) => {
                const when = eventDate(row.time);
                const status = STATUS[row.status || "planned"];
                const meetingUrl = row.location ? safeUrl(row.location) : "";
                return (
                  <li key={row.id} className="activity-row">
                    <p className="activity-when">
                      <time dateTime={row.time}>
                        <span>{when.day}</span>
                        {when.clock && <span>{when.clock}</span>}
                      </time>
                    </p>
                    <div className="activity-body">
                      <div className="activity-title">
                        <h3>{row.name}</h3>
                        <span className={`council-tag ${status.tone}`}>
                          {status.label}
                        </span>
                      </div>
                      <dl className="daily-meta">
                        <div>
                          <dt>举办者</dt>
                          <dd>{row.organizer || "待安排"}</dd>
                        </div>
                        <div>
                          <dt>参与 / 协助</dt>
                          <dd>{row.participants || "未填写"}</dd>
                        </div>
                        <div>
                          <dt>地点</dt>
                          <dd>
                            {meetingUrl ? (
                              <a
                                className="council-link"
                                target="_blank"
                                rel="noreferrer"
                                href={meetingUrl}
                              >
                                进入线上会议
                                <span className="ac-visually-hidden">
                                  （在新窗口打开）
                                </span>
                              </a>
                            ) : (
                              row.location || "待定"
                            )}
                          </dd>
                        </div>
                      </dl>
                      {row.description && (
                        <p className="notes-text daily-notes">
                          {row.description}
                        </p>
                      )}
                      <div className="workspace-actions">
                        <button
                          type="button"
                          className="workspace-button"
                          onClick={(event) => {
                            form.remember(event.currentTarget);
                            setEditing(row);
                          }}
                        >
                          编辑活动
                          <span className="ac-visually-hidden">
                            ：{row.name}
                          </span>
                        </button>
                        <DeleteButton
                          name={row.name}
                          onDelete={() =>
                            workspace.remove("activities", row.id)
                          }
                          onDeleted={() => results.current?.focus()}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}
    </div>
  );
}
