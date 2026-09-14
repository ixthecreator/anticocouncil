import { useRef, useState } from "react";
import type { Attendance, Meeting } from "../types";
import { DEFAULT_DEPARTMENTS } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import { latestReport } from "../lib/workspace";
import { mergeEditedRecord } from "../lib/editRecord";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";

export function mergeAttendanceReport(latest: Attendance | null, original: Attendance, edited: Attendance, now: string): Attendance {
  const merged = mergeEditedRecord(latest, original, { ...edited, reportNote: edited.reportNote.trim() }, ["reportStatus", "reportNote"]);
  if (merged.reportStatus === "exempt" && !merged.reportNote)
    throw new Error("请填写免汇报原因，例如“周三已汇报”。");
  return {
    ...merged,
    reportedAt: merged.reportStatus === "reported" ? latest?.reportedAt || now : "",
  };
}

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
  const [editingOriginal, setEditingOriginal] = useState<Attendance | null>(null);
  const [savingReport, setSavingReport] = useState(false);
  const reportPending = useRef(false);
  const records = data.attendance
    .filter((r) => r.meetingId === meeting.id)
    .sort(
      (a, b) =>
        a.checkedInAt.localeCompare(b.checkedInAt) || a.id.localeCompare(b.id),
    );
  const next = records.find((r) => r.reportStatus === "pending");
  return (
    <section className="workspace-panel">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">01 / CHECK IN</span>
          <h2>
            签到与分享顺序{" "}
            <small>
              {records.length} / {data.members.length}
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
              throw new Error("此部门已有同名成员，请直接选择签到。");
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
        <Field label="签到成员">
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            <option value="">请选择成员</option>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.role}
                {records.some((r) => r.memberId === m.id) ? "（已签到）" : ""}
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
            const id = `${meeting.id}__${member.id}`;
            await change(
              "attendance",
              id,
              (old) =>
                old || {
                  id,
                  meetingId: meeting.id,
                  memberId: member.id,
                  memberName: member.name,
                  checkedInAt: new Date().toISOString(),
                  reportStatus: "pending",
                  reportNote: "",
                },
            );
          }}
        >
          签到
        </Action>
      </div>
      <p className="workspace-help">
        按签到时间依次分享。
        {next
          ? `下一位：${next.memberName}`
          : records.length
            ? "本次分享已全部处理。"
            : "签到后会自动加入分享队列。"}
      </p>
      {!records.length ? (
        <Empty>还没有签到记录。先添加成员，再选择姓名签到。</Empty>
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
            const previousMeeting = data.meetings.find(
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
                    {new Date(r.checkedInAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    签到
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
                  disabled={savingReport}
                  onClick={() => {
                    if (reportPending.current) return;
                    setEditingOriginal(structuredClone(r));
                    setEditing(structuredClone(r));
                  }}
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
          onBusyChange={busy => { reportPending.current = busy; setSavingReport(busy); }}
          onCancel={() => { setEditing(null); setEditingOriginal(null); }}
          onSave={async () => {
            if (!editingOriginal) throw new Error("请重新打开汇报记录后编辑。");
            const now = new Date().toISOString();
            await change("attendance", editing.id, old => mergeAttendanceReport(old, editingOriginal, editing, now));
            setEditing(null);
            setEditingOriginal(null);
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
