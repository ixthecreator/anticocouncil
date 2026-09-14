import { useRef, useState } from "react";
import type { ActivityEvent } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import { localDate, safeUrl } from "../lib/workspace";
import { mergeEditedRecord } from "../lib/editRecord";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";
const activityFields = [
  "time",
  "name",
  "organizer",
  "participants",
  "location",
  "description",
  "status",
] as const satisfies readonly (keyof ActivityEvent)[];
export function ActivityView({
  workspace,
  search,
}: {
  workspace: Workspace;
  search: string;
}) {
  const [month, setMonth] = useState("");
  const [editing, setEditing] = useState<ActivityEvent | null>(null);
  const [deleting, setDeleting] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const draftPending = useRef(false);
  const originalRecord = useRef<ActivityEvent | null>(null);
  const beginEditing = (row: ActivityEvent | null) => {
    if (draftPending.current) return;
    originalRecord.current = row ? structuredClone(row) : null;
    setEditing(
      row
        ? structuredClone(row)
        : {
            id: crypto.randomUUID(),
            time: `${localDate()}T19:00`,
            name: "",
            organizer: "",
            participants: "",
            location: "",
            description: "",
            status: "planned",
          },
    );
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
  return (
    <section className="workspace-panel">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">SALON / CALENDAR</span>
          <h2>月度线上沙龙</h2>
        </div>
        <button
          type="button"
          className="workspace-button primary"
          disabled={formBusy}
          onClick={() => beginEditing(null)}
        >
          ＋ 新增活动
        </button>
      </div>
      <div className="workspace-actions">
        <Field label="筛选月份">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
        {month && (
          <button className="workspace-button" onClick={() => setMonth("")}>
            查看全部
          </button>
        )}
        <a
          className="resource-link"
          target="_blank"
          rel="noreferrer"
          href="https://docs.qq.com/sheet/DSm5ubnNnSktMY2R5?tab=BB08J2"
        >
          原月度安排表 ↗
        </a>
      </div>
      {editing && (
        <SaveForm
          key={editing.id}
          onBusyChange={(busy) => {
            draftPending.current = busy;
            setFormBusy(busy);
          }}
          onCancel={() => setEditing(null)}
          onSave={async () => {
            if (!editing.name.trim()) throw new Error("请输入活动主题。");
            const original = originalRecord.current;
            const edited = {
              ...editing,
              name: editing.name.trim(),
            };
            await workspace.change("activities", editing.id, (latest) =>
              mergeEditedRecord(latest, original, edited, activityFields),
            );
            setEditing(null);
          }}
        >
          <Field label="沙龙主题">
            <input
              required
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </Field>
          <Field label="活动时间（北京时间）">
            <input
              required
              type="datetime-local"
              value={editing.time.replace(" ", "T")}
              onChange={(e) => setEditing({ ...editing, time: e.target.value })}
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
      )}
      {!rows.length ? (
        <Empty>
          {month || search
            ? "当前月份或搜索条件下没有活动。"
            : "尚无沙龙安排，添加主题和时间开始排期。"}
        </Empty>
      ) : (
        <div className="record-list">
          {rows.map((row) => (
            <article key={row.id} className="record-card">
              <div className="workspace-heading">
                <div>
                  <span className="eyebrow">{row.time.replace("T", " ")}</span>
                  <h3>{row.name}</h3>
                </div>
                <span className="workspace-badge">
                  {
                    {
                      planned: "计划中",
                      completed: "已结束",
                      cancelled: "已取消",
                    }[row.status || "planned"]
                  }
                </span>
              </div>
              <p>
                举办者：{row.organizer || "待安排"}　参与 / 协助：
                {row.participants || "未填写"}
              </p>
              {row.location &&
                (safeUrl(row.location) ? (
                  <a
                    className="resource-link"
                    target="_blank"
                    rel="noreferrer"
                    href={safeUrl(row.location)}
                  >
                    进入线上会议 ↗
                  </a>
                ) : (
                  <p>地点：{row.location}</p>
                ))}
              {row.description && (
                <p className="notes-text">{row.description}</p>
              )}
              <div className="workspace-actions">
                <button
                  className="workspace-button"
                  disabled={formBusy}
                  onClick={() => beginEditing(row)}
                >
                  编辑活动
                </button>
                {deleting === row.id ? (
                  <>
                    <Action
                      className="danger"
                      disabled={formBusy}
                      onClick={() => workspace.remove("activities", row.id)}
                    >
                      确认删除
                    </Action>
                    <button
                      className="workspace-button"
                      disabled={formBusy}
                      onClick={() => setDeleting("")}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    className="workspace-button subtle"
                    disabled={formBusy}
                    onClick={() => setDeleting(row.id)}
                  >
                    删除
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
