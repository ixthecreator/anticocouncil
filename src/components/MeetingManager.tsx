import React, { useEffect, useRef, useState } from "react";
import { Meeting, Issue, Member } from "../types";
import { CalendarDays, Pencil, Plus, X } from "lucide-react";
import { localDate } from "../lib/workspace";
import { renameMeeting } from "../lib/meetingRename";

interface MeetingManagerProps {
  ready?: boolean;
  meetings: Meeting[];
  issues: Issue[];
  members: Member[];
  currentMeetingId: string | null;
  onSelectMeeting: (id: string | null) => void;
  onAddMeeting: (meeting: Meeting) => Promise<void>;
  onRenameMeeting: (
    id: string,
    expectedTitle: string,
    title: string,
  ) => Promise<void>;
  onUpdateMeetingSummary: (id: string, summary: string) => void;
  onDeleteMeeting: (id: string) => void;
}

export const MeetingManager: React.FC<MeetingManagerProps> = ({
  ready = true,
  onAddMeeting,
  onRenameMeeting,
  meetings,
  currentMeetingId,
  onSelectMeeting,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingDate, setNewMeetingDate] = useState(localDate());
  const [renameDraft, setRenameDraft] = useState<{
    meetingId: string;
    expectedTitle: string;
    title: string;
  } | null>(null);
  const [renameError, setRenameError] = useState("");
  const operationPending = useRef(false);
  const renameVersion = useRef(0);
  const renameButton = useRef<HTMLButtonElement>(null);
  const selectedMeeting = meetings.find(
    (meeting) => meeting.id === currentMeetingId,
  );

  useEffect(() => {
    renameVersion.current++;
    setRenameDraft(null);
    setRenameError("");
  }, [currentMeetingId]);

  const closeRename = (restoreFocus = true) => {
    renameVersion.current++;
    setRenameDraft(null);
    setRenameError("");
    if (restoreFocus) {
      requestAnimationFrame(() => renameButton.current?.focus());
    }
  };

  const handleRenameMeeting = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || operationPending.current || !renameDraft) return;
    const draft = renameDraft;
    const version = renameVersion.current;
    setRenameError("");
    if (draft.title.trim() && draft.title.trim() === draft.expectedTitle) {
      closeRename();
      return;
    }
    try {
      const updated = renameMeeting(
        meetings.find((meeting) => meeting.id === draft.meetingId) || null,
        draft.expectedTitle,
        draft.title,
      );
      operationPending.current = true;
      setBusy(true);
      await onRenameMeeting(draft.meetingId, draft.expectedTitle, updated.title);
      if (renameVersion.current === version) closeRename();
    } catch (err) {
      if (renameVersion.current === version) {
        setRenameError(
          err instanceof Error ? err.message : "修改名称失败，请重试。",
        );
      }
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  };

  const getWeekdayCN = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = new Date(`${dateStr}T12:00:00`);
    const weekdays = [
      "星期日",
      "星期一",
      "星期二",
      "星期三",
      "星期四",
      "星期五",
      "星期六",
    ];
    return weekdays[date.getDay()];
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || operationPending.current || !newMeetingDate) return;
    const today = new Date(`${newMeetingDate}T12:00:00`);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const title = newMeetingTitle.trim() || `${year}年${month}月${day}日例会`;
    const newMeeting: Meeting = {
      id: crypto.randomUUID(),
      title,
      week: getWeekdayCN(newMeetingDate),
      date: newMeetingDate,
      summary: "",
      regularReport: "",
      createdAt: new Date().toISOString(),
      issueIds: [],
    };

    operationPending.current = true;
    setBusy(true);
    setError("");
    try {
      await onAddMeeting(newMeeting);
      setNewMeetingTitle("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="meeting-toolbar" aria-label="例会选择">
      <div className="meeting-toolbar-title">
        <span className="meeting-icon">
          <CalendarDays size={21} />
        </span>
        <div>
          <strong>当前例会</strong>
          <span>
            {meetings.length ? "选择要处理的会议" : "从一场新的讨论开始"}
          </span>
        </div>
      </div>
      <label className="meeting-select">
        <span className="sr-only">切换例会</span>
        <select
          disabled={!ready || busy || !meetings.length}
          value={currentMeetingId || ""}
          onChange={(e) => onSelectMeeting(e.target.value)}
        >
          <option disabled value="">
            {meetings.length ? "选择例会" : "暂无例会，请先创建"}
          </option>
          {[...meetings]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.date} · {m.title}
              </option>
            ))}
        </select>
      </label>
      <button
        ref={renameButton}
        type="button"
        className="workspace-button"
        disabled={!ready || busy || !selectedMeeting}
        aria-expanded={!!renameDraft}
        aria-controls="rename-meeting-form"
        onClick={() => {
          if (!ready || operationPending.current || !selectedMeeting) return;
          if (renameDraft) {
            closeRename();
            return;
          }
          renameVersion.current++;
          setAdding(false);
          setRenameError("");
          setRenameDraft({
            meetingId: selectedMeeting.id,
            expectedTitle: selectedMeeting.title,
            title: selectedMeeting.title,
          });
        }}
      >
        <Pencil size={17} aria-hidden="true" />
        修改名称
      </button>
      <button
        type="button"
        disabled={!ready || busy}
        className={`workspace-button ${adding ? "" : "primary"}`}
        aria-expanded={adding}
        aria-controls="new-meeting-form"
        onClick={() => {
          if (!ready || operationPending.current) return;
          closeRename(false);
          setAdding(!adding);
        }}
      >
        {adding ? <X size={17} /> : <Plus size={17} />}
        {adding ? "收起" : "新建例会"}
      </button>
      {renameDraft && renameDraft.meetingId === currentMeetingId && (
        <form
          id="rename-meeting-form"
          className="meeting-create-form"
          onSubmit={handleRenameMeeting}
        >
          <label className="workspace-field" style={{ gridColumn: "1 / -1" }}>
            <span>会议名称</span>
            <input
              autoFocus
              required
              type="text"
              aria-label="修改会议名称"
              aria-invalid={!!renameError}
              aria-describedby={renameError ? "rename-meeting-error" : undefined}
              disabled={!ready || busy}
              value={renameDraft.title}
              onChange={(event) =>
                setRenameDraft({ ...renameDraft, title: event.target.value })
              }
            />
          </label>
          <div className="workspace-actions" style={{ gridColumn: "1 / -1" }}>
            <button
              type="submit"
              className="workspace-button primary"
              disabled={!ready || busy}
            >
              {busy ? "正在保存…" : "保存名称"}
            </button>
            <button
              type="button"
              className="workspace-button"
              disabled={busy}
              onClick={() => closeRename()}
            >
              取消
            </button>
          </div>
          {renameError && (
            <p id="rename-meeting-error" role="alert" className="workspace-error">
              {renameError}
            </p>
          )}
        </form>
      )}
      {adding && (
        <form
          id="new-meeting-form"
          className="meeting-create-form"
          onSubmit={handleCreateMeeting}
        >
          <label className="workspace-field">
            <span>
              例会名称 <small>选填，留空将按日期命名</small>
            </span>
            <input
              autoFocus
              aria-label="例会名称"
              type="text"
              disabled={!ready || busy}
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
              placeholder="例如：九月第一次工作例会"
            />
          </label>
          <label className="workspace-field">
            <span>召开日期</span>
            <input
              aria-label="召开日期"
              required
              type="date"
              disabled={!ready || busy}
              value={newMeetingDate}
              onChange={(e) => setNewMeetingDate(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={!ready || busy}
            className="workspace-button primary"
          >
            <Plus size={17} />
            {busy ? "正在保存…" : "创建例会"}
          </button>
          {error && (
            <p role="alert" className="workspace-error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
};
