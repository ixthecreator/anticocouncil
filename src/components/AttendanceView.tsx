import { useState } from "react";
import type { Attendance, Meeting } from "../types";
import { DEFAULT_DEPARTMENTS } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import { latestReport, reportingWeek, weeklyReports } from "../lib/workspace";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";

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
  const records = weeklyReports(data, meeting.date)
    .sort(
      (a, b) =>
        a.checkedInAt.localeCompare(b.checkedInAt) || a.id.localeCompare(b.id),
    );
  const next = records.find((r) => r.reportStatus === "pending");
  return (
    <section className="workspace-panel">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">01 / WEEKLY REPORT</span>
          <h2>
            本周汇报{" "}
            <small>
              {records.filter((r) => r.reportStatus === "reported").length} / {records.length}
            </small>
          </h2>
        </div>
        <button className="workspace-button" onClick={() => setAdding(!adding)}>
          {adding ? "收起" : "＋ 添加成员"}
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
        <Field label="本周需要汇报的成员">
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
          }}
        >
          安排汇报
        </Action>
      </div>
      <p className="workspace-help">
        同一自然周只安排一次汇报；两次例会共用本周进度。
        {next
          ? `下一位：${next.memberName}`
          : records.length
            ? "本周汇报已全部处理。"
            : "请选择本周需要汇报的成员。"}
      </p>
      {!records.length ? (
        <Empty>本周还没有安排汇报人员。</Empty>
      ) : (
        <ol className="attendance-list">
          {records.map((r, index) => {
            const previous = latestReport(
              data.attendance,
              r.memberId,
              meeting.id,
              meeting.date,
              data,
            );
            const previousMeeting = previous?.id === r.id ? undefined : data.meetings.find(
              (m) => m.id === previous?.meetingId,
            );
            return (
              <li
                key={r.id}
                className={next?.id === r.id ? "next-speaker" : ""}
              >
                <span className="queue-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="attendance-person">
                  <strong>{r.memberName}</strong>
                  <span className="workspace-help">
                    {data.meetings.find((m) => m.id === r.meetingId)?.date || meeting.date} 场次
                    {previousMeeting
                      ? ` · 上次汇报 ${previousMeeting.date}`
                      : ""}
                  </span>
                  {r.reportNote && <p>{r.reportNote}</p>}
                </div>
                <span
                  className={`workspace-badge ${r.reportStatus === "reported" ? "success" : ""}`}
                >
                  {
                    {
                      pending: "待汇报",
                      reported: "已汇报",
                      exempt: "本次免汇报",
                    }[r.reportStatus]
                  }
                </span>
                <button
                  className="workspace-button"
                  onClick={() => setEditing(r)}
                >
                  记录汇报
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {editing && (
        <SaveForm
          key={editing.id}
          onCancel={() => setEditing(null)}
          onSave={async () => {
            if (editing.reportStatus === "exempt" && !editing.reportNote.trim())
              throw new Error("请填写免汇报原因，例如“周三已汇报”。");
            await change("attendance", editing.id, (old) => {
              if (!old) throw new Error("汇报记录不存在");
              return {
                ...old,
                reportStatus: editing.reportStatus,
                reportNote: editing.reportNote.trim(),
                reportedAt:
                  editing.reportStatus === "reported"
                    ? old.reportedAt || new Date().toISOString()
                    : "",
              };
            });
            setEditing(null);
          }}
        >
          <Field label={`${editing.memberName} · 汇报状态`}>
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
