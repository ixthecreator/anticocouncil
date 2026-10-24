import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Attendance, Meeting } from "../types";
import { DEFAULT_DEPARTMENTS } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import { latestReport, reportMeetingId, reportingWeek, updateReport, weeklyReports } from "../lib/workspace";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";

/* Tag colours support the text label; they never carry the status alone. */
const reportLabels: Record<Attendance["reportStatus"], string> = {
  pending: "待汇报",
  reported: "已汇报",
  exempt: "免汇报",
};
const reportTone: Record<Attendance["reportStatus"], string> = {
  pending: "amber",
  reported: "green",
  exempt: "grey",
};

export function AttendanceView({
  meeting,
  workspace,
}: {
  meeting: Meeting;
  workspace: Workspace;
}) {
  const { data, save, change } = workspace;
  const [memberId, setMemberId] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState(DEFAULT_DEPARTMENTS[0]);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [original, setOriginal] = useState<Attendance | null>(null);
  // 安排汇报 disables itself once the member is in the queue. Focus then
  // moves to the member's new row in the table, once it has rendered.
  const focusTarget = useRef("");
  const moveFocus = () => {
    const target = focusTarget.current
      ? document.getElementById(focusTarget.current)
      : null;
    if (!target) return;
    focusTarget.current = "";
    target.focus();
  };
  useEffect(moveFocus);
  const weekMeetings = data.meetings
    .filter((candidate) => reportingWeek(candidate.date) === reportingWeek(meeting.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const records = weeklyReports(data, meeting.date)
    .sort(
      (a, b) =>
        a.checkedInAt.localeCompare(b.checkedInAt) || a.id.localeCompare(b.id),
    );
  const next = records.find((r) => r.reportStatus === "pending");
  const reportedCount = records.filter((r) => r.reportStatus === "reported").length;
  return (
    <section className="workspace-panel" aria-labelledby="weekly-report-heading">
      <div className="workspace-heading">
        <h2 id="weekly-report-heading">
          本周汇报{" "}
          <small>
            已汇报 {reportedCount} / {records.length}
          </small>
        </h2>
        <button
          type="button"
          className="workspace-button"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          {adding ? (
            <X size={18} aria-hidden="true" />
          ) : (
            <Plus size={18} aria-hidden="true" />
          )}
          {adding ? "收起" : "添加成员"}
        </button>
      </div>
      {adding && (
        <SaveForm
          onCancel={() => setAdding(false)}
          onSave={async () => {
            if (!name.trim()) throw new Error("请输入成员姓名。");
            if (
              data.members.some(
                (m) => m.name.trim() === name.trim() && m.role === role,
              )
            )
              throw new Error("此部门已有同名成员，请直接选择汇报。");
            const id = crypto.randomUUID();
            await save("members", {
              id,
              name: name.trim(),
              role,
              avatarSymbol: name.trim().slice(0, 1),
            });
            setMemberId(id);
            setName("");
            setAdding(false);
          }}
        >
          <h3 className="session-subheading">添加成员</h3>
          <Field label="成员姓名">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field label="所属部门">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {DEFAULT_DEPARTMENTS.map((dept) => (
                <option key={dept}>{dept}</option>
              ))}
            </select>
          </Field>
        </SaveForm>
      )}
      <div className="checkin-form">
        <Field
          label="本周需要汇报的成员"
          hint="同一自然周只安排一次汇报；两次例会共用本周进度。"
        >
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            <option value="">请选择成员</option>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.role}
                {records.some((r) => r.memberId === m.id) ? "（本周已安排）" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Action
          className="primary"
          disabled={!memberId || records.some((r) => r.memberId === memberId)}
          onClick={async () => {
            const member = data.members.find((m) => m.id === memberId);
            if (!member) return;
            const id = `${reportingWeek(meeting.date)}__${member.id}`;
            await change(
              "attendance",
              id,
              (old) =>
                old || {
                  id,
                  meetingId: meeting.id,
                  memberId: member.id,
                  memberName: member.name,
                  // Keep the legacy storage field for existing backups and cloud records.
                  checkedInAt: new Date().toISOString(),
                  reportStatus: "pending",
                  reportNote: "",
                  reportAssigned: true,
                },
            );
            focusTarget.current = `attendance-row-${id}`;
            requestAnimationFrame(moveFocus);
          }}
        >
          安排汇报
        </Action>
      </div>
      {!records.length ? (
        <Empty>本周还没有安排汇报人员。请选择本周需要汇报的成员。</Empty>
      ) : (
        <>
          <p className="attendance-summary">
            {next
              ? `下一位：${next.memberName}`
              : "本周汇报已全部处理。"}
          </p>
          <div className="council-table-wrap">
            <table className="council-table attendance-table">
              <caption className="ac-visually-hidden">
                本周汇报安排，按安排先后排序
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="attendance-queue">
                    序号
                  </th>
                  <th scope="col">成员</th>
                  <th scope="col" className="attendance-status">
                    汇报状态
                  </th>
                  <th scope="col">
                    <span className="ac-visually-hidden">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, index) => {
                  const previous = latestReport(
                    data.attendance,
                    r.memberId,
                    meeting.id,
                    meeting.date,
                    data,
                  );
                  const previousMeeting = previous?.id === r.id ? undefined : data.meetings.find(
                    (m) => previous && m.id === reportMeetingId(previous),
                  );
                  const isNext = next?.id === r.id;
                  return (
                    <tr key={r.id} className={isNext ? "is-next" : undefined}>
                      <td className="attendance-queue">{index + 1}</td>
                      <th scope="row" id={`attendance-row-${r.id}`} tabIndex={-1}>
                        <span className="attendance-name">
                          {r.memberName}
                          {isNext && (
                            <span className="council-tag purple">下一位</span>
                          )}
                        </span>
                        <span className="council-meta">
                          {r.reportStatus === "pending" ? "安排于 " : r.reportStatus === "reported" ? "汇报于 " : "免汇报于 "}
                          {data.meetings.find((m) => m.id === reportMeetingId(r))?.date || "会议已删除"}
                          {previousMeeting
                            ? ` · 上次汇报 ${previousMeeting.date}`
                            : ""}
                        </span>
                        {r.reportNote && (
                          <span className="attendance-note">{r.reportNote}</span>
                        )}
                      </th>
                      <td className="attendance-status">
                        <span className={`council-tag ${reportTone[r.reportStatus]}`}>
                          {reportLabels[r.reportStatus]}
                        </span>
                      </td>
                      <td className="attendance-action">
                        <button
                          type="button"
                          className="workspace-button"
                          onClick={() => {
                            setOriginal(r);
                            setEditing({ ...r, reportMeetingId: r.reportStatus === "pending" ? meeting.id : reportMeetingId(r) });
                          }}
                        >
                          记录汇报
                          <span className="ac-visually-hidden">：{r.memberName}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {editing && (
        <SaveForm
          key={editing.id}
          onCancel={() => setEditing(null)}
          onSave={async () => {
            if (!original) return;
            const now = new Date().toISOString();
            await change("attendance", editing.id, (old) =>
              updateReport(old, original, editing, data.meetings, now),
            );
            setEditing(null);
          }}
        >
          <h3 className="session-subheading">记录汇报：{editing.memberName}</h3>
          <Field label="汇报状态">
            <select
              value={editing.reportStatus}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  reportStatus: e.target.value as Attendance["reportStatus"],
                })
              }
            >
              <option value="pending">待汇报</option>
              <option value="reported">已汇报</option>
              <option value="exempt">本次免汇报</option>
            </select>
          </Field>
          {editing.reportStatus !== "pending" && <Field label="汇报场次">
            <select
              required
              value={editing.reportMeetingId || ""}
              onChange={(e) => setEditing({ ...editing, reportMeetingId: e.target.value })}
            >
              <option value="">请选择实际汇报或免汇报的会议</option>
              {weekMeetings.map((candidate) => <option key={candidate.id} value={candidate.id}>
                {candidate.date} · {candidate.title}
              </option>)}
            </select>
          </Field>}
          <Field label="汇报内容或免汇报原因">
            <textarea
              value={editing.reportNote}
              onChange={(e) =>
                setEditing({ ...editing, reportNote: e.target.value })
              }
              rows={3}
            />
          </Field>
        </SaveForm>
      )}
    </section>
  );
}
