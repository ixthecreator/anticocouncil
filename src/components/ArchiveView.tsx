import React, { useEffect, useRef, useState } from "react";
import { Meeting, Issue } from "../types";
import {
  Folder,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Trash2,
} from "lucide-react";

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Meeting List & Export Settings */}
      <div className="lg:col-span-4 space-y-6">
        <div className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md flex flex-col max-h-[500px]">
          <div className="p-4 border-b-2 border-[var(--theme-border,#171717)]">
            <h3 className="font-sans text-sm font-bold tracking-normal uppercase flex items-center gap-1.5 text-[var(--theme-text-primary)]">
              <Folder className="w-4 h-4" />
              <span>会议目录</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {meetings.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={exportBusy}
                onClick={() => setSelectedMeetingId(m.id)}
                className={`w-full text-left p-3 border-2 transition-all disabled:cursor-wait ${
                  selectedMeetingId === m.id
                    ? "border-[var(--theme-border,#171717)] bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)]"
                    : "border-[var(--theme-border)]/20 bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary)] hover:border-[var(--theme-border,#171717)]"
                }`}
              >
                <h4 className="font-sans font-bold text-sm">{m.title}</h4>
                <p className="font-sans text-xs mt-1 opacity-80">
                  {m.week} | {m.date}
                </p>
              </button>
            ))}
            {meetings.length === 0 && (
              <p className="p-3 text-xs font-sans text-[var(--theme-text-secondary,#525252)]">
                {!dataLoaded
                  ? "正在载入会议档案…"
                  : allMeetings.length > 0
                    ? "未找到匹配会议，可调整搜索条件。"
                    : "档案库为空，尚无任何例会记录。"}
              </p>
            )}
          </div>
        </div>

        {/* EXPORTER PANEL */}
        <section aria-labelledby="archive-export-heading" aria-busy={exportBusy} className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-4 space-y-4 text-[var(--theme-text-primary,#171717)]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h3 id="archive-export-heading" className="font-sans text-sm font-bold tracking-normal uppercase text-[var(--theme-text-primary,#171717)] flex items-center gap-2">
              导出会议档案
            </h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="archive-document-kind" className="block text-xs font-sans font-bold">
                文档类型
              </label>
              <select
                id="archive-document-kind"
                value={documentKind}
                onChange={(event) => setDocumentKind(event.target.value as "agenda" | "minutes")}
                disabled={!dataLoaded || exportBusy}
                className="w-full border border-[var(--theme-border,#171717)] p-2 text-sm font-sans bg-[var(--theme-card-bg,#ffffff)] disabled:opacity-50"
              >
                <option value="minutes">完整会议纪要</option>
                <option value="agenda">会议议程</option>
              </select>
            </div>

            <fieldset disabled={!dataLoaded || exportBusy} className="space-y-2 disabled:opacity-60">
              <legend className="mb-1.5 text-xs font-sans font-bold">导出范围</legend>
              <label className="flex items-center gap-2 text-xs font-sans cursor-pointer">
                <input type="radio" name="archive-export-scope" value="current" checked={exportScope === "current"} onChange={() => setExportScope("current")} />
                <span>当前查看会议</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-sans cursor-pointer">
                <input type="radio" name="archive-export-scope" value="selected" checked={exportScope === "selected"} onChange={() => setExportScope("selected")} />
                <span>手动选择会议</span>
              </label>
            </fieldset>

            {exportScope === "selected" && (
              <fieldset disabled={!dataLoaded || exportBusy} className="space-y-1.5 disabled:opacity-60">
                <legend className="mb-1.5 text-xs font-sans font-bold">从全部会议中选择</legend>
                <p className="text-xs font-sans text-[var(--theme-text-secondary,#525252)]">手动选择会保留，不受搜索结果影响。</p>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {allMeetings.map((meeting) => (
                    <label key={meeting.id} className="flex items-start gap-2 p-2 border border-neutral-200 hover:border-[var(--theme-border,#171717)] transition-colors cursor-pointer text-xs font-sans bg-[var(--theme-card-bg,#ffffff)]">
                      <input
                        type="checkbox"
                        checked={selectedExportIds.includes(meeting.id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedExportIds((previous) => checked
                            ? previous.includes(meeting.id) ? previous : [...previous, meeting.id]
                            : previous.filter((id) => id !== meeting.id));
                        }}
                        className="mt-0.5 shrink-0 cursor-pointer"
                      />
                      <span className="min-w-0 break-words">
                        <span className="block font-bold">{meeting.title}</span>
                        <span className="block mt-1 text-[var(--theme-text-secondary,#525252)]">{meeting.date} · {meeting.week}</span>
                      </span>
                    </label>
                  ))}
                  {allMeetings.length === 0 && <p className="text-xs font-sans text-[var(--theme-text-secondary,#525252)]">暂无可选会议。</p>}
                </div>
              </fieldset>
            )}

            <div className="border border-neutral-200 p-3 space-y-2 text-xs font-sans bg-[var(--theme-card-bg,#ffffff)]">
              <p className="font-bold">{exportScope === "current" ? "当前导出会议" : `已选择 ${meetingsToExport.length} 场会议`}</p>
              {meetingsToExport.length > 0 ? (
                <ul className="space-y-2">
                  {meetingsToExport.map((meeting) => (
                    <li key={meeting.id} className="break-words">
                      <span className="block">{meeting.title}</span>
                      <span className="block mt-0.5 text-[var(--theme-text-secondary,#525252)]">{meeting.date} · {meeting.week}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--theme-text-secondary,#525252)]">
                  {!dataLoaded ? "会议数据载入后即可导出。" : exportScope === "current" ? "请先在会议目录中选择一场会议。" : "请选择至少一场会议。"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => void handleExport("pdf")}
                disabled={exportDisabled}
                className="py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)] font-sans text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer text-center flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>导出 PDF</span>
              </button>
              <button
                type="button"
                onClick={() => void handleExport("docx")}
                disabled={exportDisabled}
                className="py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs font-bold hover:bg-[var(--theme-accent-light,rgba(0,0,0,0.05))] transition-colors cursor-pointer text-center flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>导出 Word</span>
              </button>
              <button
                type="button"
                onClick={() => void handleExport("latex")}
                disabled={exportDisabled}
                className="col-span-2 py-2 border border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs font-bold hover:bg-[var(--theme-accent-light,rgba(0,0,0,0.05))] transition-colors cursor-pointer text-center flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>导出完整纪要 LaTeX</span>
              </button>
            </div>
            <p className="text-xs text-[var(--theme-text-secondary,#525252)] font-sans leading-normal">
              PDF 和 Word 使用所选文档类型；LaTeX 始终导出完整会议纪要。
            </p>
            {exportBusy && <p role="status" aria-live="polite" className="text-xs font-sans">{exportStatus || "正在生成文件…"}</p>}
            {exportError && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-xs font-sans text-red-800">{exportError}</p>}
          </div>
        </section>
      </div>

      {/* Right Column: Meeting Detail */}
      <div className="lg:col-span-8 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-6 min-h-[800px] text-[var(--theme-text-primary)]">
        {selectedMeeting ? (
          <div className="space-y-8">
            <header className="border-b-2 border-[var(--theme-border)] pb-4 flex justify-between items-start">
              <div>
                <h2 className="font-sans text-3xl font-bold mb-2">
                  {selectedMeeting.title}
                </h2>
                <div className="flex gap-4 font-sans text-xs opacity-80">
                  <span>会期: {selectedMeeting.week}</span>
                  <span>日期: {selectedMeeting.date}</span>
                </div>
              </div>
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
                className={`p-2 border transition-colors ${confirmDeleteId === selectedMeeting.id ? "border-red-500 bg-red-500 text-white" : "border-red-200 text-red-600 hover:bg-red-50"}`}
                title={
                  confirmDeleteId === selectedMeeting.id
                    ? "点击确认删除"
                    : "删除存档"
                }
              >
                {confirmDeleteId === selectedMeeting.id ? (
                  <span className="text-xs font-bold px-1">确认删除?</span>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </header>

            <section>
              <h3 className="font-sans text-sm font-bold uppercase mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> 常规报告摘要
              </h3>
              <div className="bg-[var(--theme-card-bg)] border-2 border-[var(--theme-border)] p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap min-h-[100px]">
                {selectedMeeting.regularReport || "本期无常规报告记录。"}
              </div>
            </section>

            <section>
              <h3 className="font-sans text-sm font-bold uppercase mb-3 flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" /> 经表决通过的议案 (
                {passedIssues.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {passedIssues.length === 0 ? (
                  <p className="text-xs font-sans opacity-60 italic col-span-full">
                    无通过议案
                  </p>
                ) : (
                  passedIssues.map((issue) => (
                    <div
                      key={issue.id}
                      onClick={() => onOpenDetail(issue)}
                      className="bg-[var(--theme-card-bg)] border-2 border-[var(--theme-border)] p-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_var(--theme-border)] transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-sans text-xs uppercase px-1.5 py-0.5 border border-[var(--theme-border)] bg-[var(--theme-accent-light)]">
                          {issue.status === "completed"
                            ? "已归档"
                            : issue.status === "execution"
                              ? "执行中"
                              : issue.status === "authorization"
                                ? "授权中"
                                : "已通过"}
                        </span>
                        {issue.votes && (
                          <span className="font-sans text-xs text-green-600 font-bold border border-green-600 px-1">
                            {issue.votes.approve} 赞同
                          </span>
                        )}
                      </div>
                      <h4 className="font-sans font-bold text-sm mb-1">
                        {issue.title}
                      </h4>
                      <p className="font-sans text-xs opacity-70 line-clamp-2">
                        {issue.description || "无描述"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="font-sans text-sm font-bold uppercase mb-3 flex items-center gap-2 text-red-700">
                <XCircle className="w-4 h-4" /> 经表决否决的议案 (
                {rejectedIssues.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rejectedIssues.length === 0 ? (
                  <p className="text-xs font-sans opacity-60 italic col-span-full">
                    无否决议案
                  </p>
                ) : (
                  rejectedIssues.map((issue) => (
                    <div
                      key={issue.id}
                      onClick={() => onOpenDetail(issue)}
                      className="bg-[var(--theme-card-bg)] border-2 border-red-200 p-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_#ef4444] transition-all opacity-80"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-sans text-xs uppercase px-1.5 py-0.5 border border-red-600 bg-red-50 text-red-700">
                          已否决
                        </span>
                        {issue.votes && (
                          <span className="font-sans text-xs text-red-600 font-bold border border-red-600 px-1">
                            {issue.votes.reject} 否决
                          </span>
                        )}
                      </div>
                      <h4 className="font-sans font-bold text-sm mb-1">
                        {issue.title}
                      </h4>
                      <p className="font-sans text-xs opacity-70 line-clamp-2">
                        {issue.description || "无描述"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center font-sans text-sm opacity-50">
            请在左侧选择会期以查看详情
          </div>
        )}
      </div>
    </div>
  );
};
