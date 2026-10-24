import React, { useEffect, useRef, useState } from "react";
import { Meeting, Issue } from "../types";
import { FileText, Download, Trash2 } from "lucide-react";

interface ArchiveViewProps {
  meetings: Meeting[];
  allMeetings: Meeting[];
  dataLoaded: boolean;
  issues: Issue[];
  onOpenDetail: (issue: Issue) => void;
  onExport: (
    ids: string[],
    kind: "agenda" | "minutes",
    format: "pdf" | "docx" | "latex",
  ) => Promise<void>;
  exportStatus: string;
  exportError: string;
  onDeleteMeeting: (id: string) => Promise<void>;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  meetings,
  allMeetings,
  dataLoaded,
  issues,
  onOpenDetail,
  onExport,
  exportStatus,
  exportError,
  onDeleteMeeting,
}) => {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    meetings.length > 0 ? meetings[0].id : null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [documentKind, setDocumentKind] = useState<"agenda" | "minutes">("minutes");
  const [exportScope, setExportScope] = useState<"current" | "selected">("current");
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const exportInFlight = useRef(false);
  const exportBusy = isExporting || !!exportStatus;

  useEffect(() => {
    setSelectedMeetingId((previous) =>
      meetings.some((m) => m.id === previous)
        ? previous
        : meetings[0]?.id || null,
    );
  }, [meetings]);

  useEffect(() => {
    if (!dataLoaded) return;
    const availableIds = new Set(allMeetings.map((meeting) => meeting.id));
    setSelectedExportIds((previous) => {
      const remaining = previous.filter((id) => availableIds.has(id));
      return remaining.length === previous.length ? previous : remaining;
    });
  }, [allMeetings, dataLoaded]);

  const selectedMeeting =
    meetings.find((m) => m.id === selectedMeetingId) || null;
  const selectedExportMeetings = allMeetings.filter((meeting) =>
    selectedExportIds.includes(meeting.id),
  );
  const currentExportMeeting = selectedMeeting
    ? allMeetings.find((meeting) => meeting.id === selectedMeeting.id) || null
    : null;
  const meetingsToExport = exportScope === "current"
    ? currentExportMeeting ? [currentExportMeeting] : []
    : selectedExportMeetings;
  const exportDisabled = !dataLoaded || exportBusy || meetingsToExport.length === 0;

  const handleExport = async (format: "pdf" | "docx" | "latex") => {
    if (exportDisabled || exportInFlight.current) return;
    exportInFlight.current = true;
    setIsExporting(true);
    try {
      await onExport(
        meetingsToExport.map((meeting) => meeting.id),
        format === "latex" ? "minutes" : documentKind,
        format,
      );
    } catch {
      // The parent supplies the export error; keep the user's selection for retry.
    } finally {
      exportInFlight.current = false;
      setIsExporting(false);
    }
  };

  const meetingIssues = selectedMeeting
    ? issues.filter((i) => i.meetingId === selectedMeeting.id)
    : [];

  const passedIssues = meetingIssues.filter(
    (i) =>
      i.status === "passed" ||
      i.status === "authorization" ||
      i.status === "execution" ||
      i.status === "completed",
  );
  const rejectedIssues = meetingIssues.filter((i) => i.status === "rejected");

  /* The tag wording is decided below exactly as before; the colour only
     supports the word. */
  const passedTagTone = (status: Issue["status"]) =>
    status === "completed"
      ? "grey"
      : status === "execution" || status === "authorization"
        ? "purple"
        : "green";

  return (
    <div className="archive-layout">
      {/* Meeting directory */}
      <section
        className="archive-meetings"
        aria-labelledby="archive-meetings-heading"
      >
        <h2 id="archive-meetings-heading" className="archive-heading">
          会议目录
          {meetings.length > 0 && <small>共 {meetings.length} 场</small>}
        </h2>
        {meetings.length > 0 && (
          <ul className="archive-meeting-list">
            {meetings.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={exportBusy}
                  onClick={() => setSelectedMeetingId(m.id)}
                  aria-current={selectedMeetingId === m.id ? "true" : undefined}
                  className="archive-meeting ac-focus--inset"
                >
                  <span className="archive-meeting-title">{m.title}</span>
                  <span className="archive-meeting-meta">
                    {m.week} · {m.date}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {meetings.length === 0 && (
          <p className="workspace-empty">
            {!dataLoaded
              ? "正在载入会议档案…"
              : allMeetings.length > 0
                ? "未找到匹配会议，可调整搜索条件。"
                : "档案库为空，尚无任何例会记录。"}
          </p>
        )}
      </section>

      {/* Meeting detail */}
      {selectedMeeting ? (
        <section
          className="archive-detail"
          aria-labelledby="archive-detail-heading"
        >
          <header className="archive-detail-header">
            <h2 id="archive-detail-heading">{selectedMeeting.title}</h2>
            <p className="archive-detail-meta">
              <span>会期：{selectedMeeting.week}</span>
              <span>日期：{selectedMeeting.date}</span>
            </p>
          </header>

          <section
            className="archive-detail-section"
            aria-labelledby="archive-report-heading"
          >
            <h3 id="archive-report-heading">常规报告摘要</h3>
            <p
              className={`archive-report${selectedMeeting.regularReport ? "" : " is-empty"}`}
            >
              {selectedMeeting.regularReport || "本期无常规报告记录。"}
            </p>
          </section>

          <section
            className="archive-detail-section"
            aria-labelledby="archive-passed-heading"
          >
            <h3 id="archive-passed-heading">
              经表决通过的议案
              <small>{passedIssues.length} 项</small>
            </h3>
            {passedIssues.length === 0 ? (
              <p className="archive-none">无通过议案</p>
            ) : (
              <ul className="archive-issues">
                {passedIssues.map((issue) => (
                  <li
                    key={issue.id}
                    className="archive-issue"
                    onClick={() => onOpenDetail(issue)}
                  >
                    <h4 className="archive-issue-title">
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
                    </h4>
                    <p className="archive-issue-tags">
                      <span className={`council-tag ${passedTagTone(issue.status)}`}>
                        {issue.status === "completed"
                          ? "已归档"
                          : issue.status === "execution"
                            ? "执行中"
                            : issue.status === "authorization"
                              ? "授权中"
                              : "已通过"}
                      </span>
                      {issue.votes && (
                        <span className="archive-issue-votes">
                          赞同 {issue.votes.approve} 票
                        </span>
                      )}
                    </p>
                    <p className="archive-issue-summary">
                      {issue.description || "无描述"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="archive-detail-section"
            aria-labelledby="archive-rejected-heading"
          >
            <h3 id="archive-rejected-heading">
              经表决否决的议案
              <small>{rejectedIssues.length} 项</small>
            </h3>
            {rejectedIssues.length === 0 ? (
              <p className="archive-none">无否决议案</p>
            ) : (
              <ul className="archive-issues">
                {rejectedIssues.map((issue) => (
                  <li
                    key={issue.id}
                    className="archive-issue"
                    onClick={() => onOpenDetail(issue)}
                  >
                    <h4 className="archive-issue-title">
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
                    </h4>
                    <p className="archive-issue-tags">
                      <span className="council-tag red">已否决</span>
                      {issue.votes && (
                        <span className="archive-issue-votes">
                          否决 {issue.votes.reject} 票
                        </span>
                      )}
                    </p>
                    <p className="archive-issue-summary">
                      {issue.description || "无描述"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      ) : (
        <div className="archive-detail">
          <p className="workspace-empty">请在会议目录中选择一场会议以查看详情。</p>
        </div>
      )}

      {/* Export */}
      <section
        aria-labelledby="archive-export-heading"
        className="archive-export"
      >
        <h2 id="archive-export-heading" className="archive-heading">
          导出会议档案
        </h2>

        <div className="workspace-field">
          <label htmlFor="archive-document-kind" className="workspace-label">
            文档类型
          </label>
          <select
            id="archive-document-kind"
            value={documentKind}
            onChange={(event) => setDocumentKind(event.target.value as "agenda" | "minutes")}
            disabled={!dataLoaded || exportBusy}
          >
            <option value="minutes">完整会议纪要</option>
            <option value="agenda">会议议程</option>
          </select>
        </div>

        <fieldset disabled={!dataLoaded || exportBusy} className="archive-export-group">
          <legend>导出范围</legend>
          <label className="archive-choice">
            <input type="radio" name="archive-export-scope" value="current" checked={exportScope === "current"} onChange={() => setExportScope("current")} />
            <span>当前查看会议</span>
          </label>
          <label className="archive-choice">
            <input type="radio" name="archive-export-scope" value="selected" checked={exportScope === "selected"} onChange={() => setExportScope("selected")} />
            <span>手动选择会议</span>
          </label>
        </fieldset>

        {exportScope === "selected" && (
          <fieldset
            disabled={!dataLoaded || exportBusy}
            className="archive-export-group"
            aria-describedby="archive-export-pick-hint"
          >
            <legend>从全部会议中选择</legend>
            <p id="archive-export-pick-hint" className="workspace-help">
              手动选择会保留，不受搜索结果影响。
            </p>
            {allMeetings.length > 0 ? (
              <ul className="archive-export-options">
                {allMeetings.map((meeting) => (
                  <li key={meeting.id}>
                    <label className="archive-choice">
                      <input
                        type="checkbox"
                        checked={selectedExportIds.includes(meeting.id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedExportIds((previous) => checked
                            ? previous.includes(meeting.id) ? previous : [...previous, meeting.id]
                            : previous.filter((id) => id !== meeting.id));
                        }}
                      />
                      <span>
                        <span className="archive-choice-title">{meeting.title}</span>
                        <span className="archive-choice-meta">{meeting.date} · {meeting.week}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="workspace-help">暂无可选会议。</p>
            )}
          </fieldset>
        )}

        <div className="archive-export-summary">
          <p className="archive-export-summary-title">
            {exportScope === "current" ? "当前导出会议" : `已选择 ${meetingsToExport.length} 场会议`}
          </p>
          {meetingsToExport.length > 0 ? (
            <ul>
              {meetingsToExport.map((meeting) => (
                <li key={meeting.id}>
                  <span className="archive-choice-title">{meeting.title}</span>
                  <span className="archive-choice-meta">{meeting.date} · {meeting.week}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="archive-choice-meta">
              {!dataLoaded ? "会议数据载入后即可导出。" : exportScope === "current" ? "请先在会议目录中选择一场会议。" : "请选择至少一场会议。"}
            </p>
          )}
        </div>

        <div className="archive-export-actions">
          <div className="workspace-actions">
            <button
              type="button"
              onClick={() => void handleExport("pdf")}
              disabled={exportDisabled}
              className="workspace-button primary"
            >
              <FileText aria-hidden="true" />
              导出 PDF
            </button>
            <button
              type="button"
              onClick={() => void handleExport("docx")}
              disabled={exportDisabled}
              className="workspace-button"
            >
              <FileText aria-hidden="true" />
              导出 Word
            </button>
            <button
              type="button"
              onClick={() => void handleExport("latex")}
              disabled={exportDisabled}
              className="workspace-button"
            >
              <Download aria-hidden="true" />
              导出完整纪要 LaTeX
            </button>
          </div>
          <p className="workspace-help">
            PDF 和 Word 使用所选文档类型；LaTeX 始终导出完整会议纪要。
          </p>
        </div>
        <p role="status" aria-live="polite" className="archive-export-status">
          {exportBusy ? exportStatus || "正在生成文件…" : ""}
        </p>
        {exportError && <p role="alert" className="workspace-error">{exportError}</p>}
      </section>

      {/* Deleting the record is the last control on the page, set apart
          below a rule, as 删除议题 is at the end of the issue dialog. */}
      {selectedMeeting && (
        <div className="archive-manage">
          <button
            type="button"
            disabled={exportBusy}
            onClick={async () => {
              if (confirmDeleteId === selectedMeeting.id) {
                try {
                  await onDeleteMeeting(selectedMeeting.id);
                  const remaining = meetings.filter(
                    (m) => m.id !== selectedMeeting.id,
                  );
                  setSelectedMeetingId(
                    remaining.length > 0 ? remaining[0].id : null,
                  );
                  setConfirmDeleteId(null);
                } catch (error) {
                  console.error("Deletion failed", error);
                }
              } else {
                setConfirmDeleteId(selectedMeeting.id);
                setTimeout(() => setConfirmDeleteId(null), 3000);
              }
            }}
            aria-describedby="archive-delete-hint"
            className={`workspace-button danger archive-delete${confirmDeleteId === selectedMeeting.id ? " is-confirming" : ""}`}
          >
            <Trash2 aria-hidden="true" />
            {confirmDeleteId === selectedMeeting.id
              ? "确认删除存档？"
              : "删除存档"}
          </button>
          <p id="archive-delete-hint" className="workspace-help">
            删除「{selectedMeeting.title}」的存档。仍有关联议题或汇报记录的会议不能删除。
          </p>
        </div>
      )}
    </div>
  );
};
