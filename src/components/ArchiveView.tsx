import React, { useState } from 'react';
import { Meeting, Issue, Status } from '../types';
import { Folder, FileText, CheckCircle, XCircle, Download, Trash2 } from 'lucide-react';

interface ArchiveViewProps {
  meetings: Meeting[];
  issues: Issue[];
  onOpenDetail: (issue: Issue) => void;
  selectedMeetingIdsForExport: string[];
  isCompiling: boolean;
  onToggleMeetingExportSelection: (id: string) => void;
  onExportLatex: () => void;
  onExportPDF: () => void;
  onDeleteMeeting: (id: string) => Promise<void>;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ 
  meetings, 
  issues, 
  onOpenDetail,
  selectedMeetingIdsForExport,
  isCompiling,
  onToggleMeetingExportSelection,
  onExportLatex,
  onExportPDF,
  onDeleteMeeting
}) => {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(meetings.length > 0 ? meetings[0].id : null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId) || null;
  const meetingIssues = selectedMeeting ? issues.filter(i => i.meetingId === selectedMeeting.id) : [];

  const passedIssues = meetingIssues.filter(i => i.status === 'passed' || i.status === 'authorization' || i.status === 'execution' || i.status === 'completed');
  const rejectedIssues = meetingIssues.filter(i => i.status === 'rejected');

  if (meetings.length === 0) {
    return (
      <div className="text-center py-16 bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md border-2 border-dashed border-[var(--theme-border,#171717)] flex flex-col items-center justify-center gap-3 text-[var(--theme-text-primary,#171717)]">
        <Folder className="w-8 h-8 text-[var(--theme-text-secondary,#525252)]" />
        <h3 className="font-serif text-lg font-bold">档案库为空</h3>
        <p className="text-xs font-mono text-[var(--theme-text-secondary,#525252)] max-w-sm">
          尚无任何例会记录。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Meeting List & Export Settings */}
      <div className="lg:col-span-4 space-y-6">
        <div className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md flex flex-col max-h-[500px]">
          <div className="p-4 border-b-2 border-[var(--theme-border,#171717)]">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase flex items-center gap-1.5 text-[var(--theme-text-primary)]">
              <Folder className="w-4 h-4" />
              <span>按会期分类 (Sessions)</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {meetings.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMeetingId(m.id)}
                className={`w-full text-left p-3 border-2 transition-all ${
                  selectedMeetingId === m.id
                    ? 'border-[var(--theme-border,#171717)] bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)]'
                    : 'border-[var(--theme-border)]/20 bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary)] hover:border-[var(--theme-border,#171717)]'
                }`}
              >
                <h4 className="font-sans font-bold text-sm">{m.title}</h4>
                <p className="font-mono text-[10px] mt-1 opacity-80">{m.week} | {m.date}</p>
              </button>
            ))}
          </div>
        </div>

        {/* EXPORTER PANEL */}
        <div className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-4 space-y-4 text-[var(--theme-text-primary,#171717)]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase text-[var(--theme-text-primary,#171717)] flex items-center gap-2">
              批量导出 (Export)
            </h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
              <label className="block text-[10px] font-mono text-[var(--theme-text-secondary,#525252)] uppercase">
                选择导出周期 ({selectedMeetingIdsForExport.length} 期)
              </label>
              {meetings.map(m => {
                const isSelected = selectedMeetingIdsForExport.includes(m.id);
                return (
                  <div 
                    key={m.id} 
                    onClick={() => onToggleMeetingExportSelection(m.id)}
                    className="flex items-center gap-2 p-1.5 border border-neutral-200 hover:border-[var(--theme-border,#171717)] transition-colors cursor-pointer text-xs font-mono bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)]"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} 
                      className="cursor-pointer"
                    />
                    <span className="truncate">{m.title}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200">
              <button
                onClick={onExportLatex}
                className="py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-mono text-[10px] font-bold hover:bg-[var(--theme-accent-light,rgba(0,0,0,0.05))] transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>编译 LaTeX</span>
              </button>
              <button
                onClick={onExportPDF}
                disabled={isCompiling}
                className="py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)] font-mono text-[10px] font-bold hover:opacity-90 transition-opacity cursor-pointer text-center flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isCompiling ? 'PDF 编译中...' : '导出 PDF'}</span>
              </button>
            </div>
            <p className="text-[9px] text-[var(--theme-text-secondary,#525252)] font-mono leading-normal">
              * 导出功能将合并生成所选周期例会之常规报告与绑定的议题会商决议。
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Meeting Detail */}
      <div className="lg:col-span-8 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-6 min-h-[800px] text-[var(--theme-text-primary)]">
        {selectedMeeting ? (
          <div className="space-y-8">
            <header className="border-b-2 border-[var(--theme-border)] pb-4 flex justify-between items-start">
              <div>
                <h2 className="font-serif text-3xl font-bold mb-2">{selectedMeeting.title}</h2>
                <div className="flex gap-4 font-mono text-xs opacity-80">
                  <span>会期: {selectedMeeting.week}</span>
                  <span>日期: {selectedMeeting.date}</span>
                </div>
              </div>
              <button 
                onClick={async () => {
                  if (confirmDeleteId === selectedMeeting.id) {
                    try {
                      await onDeleteMeeting(selectedMeeting.id);
                      const remaining = meetings.filter(m => m.id !== selectedMeeting.id);
                      setSelectedMeetingId(remaining.length > 0 ? remaining[0].id : null);
                      setConfirmDeleteId(null);
                    } catch (error) {
                      console.error('Deletion failed', error);
                    }
                  } else {
                    setConfirmDeleteId(selectedMeeting.id);
                    setTimeout(() => setConfirmDeleteId(null), 3000);
                  }
                }}
                className={`p-2 border transition-colors ${confirmDeleteId === selectedMeeting.id ? 'border-red-500 bg-red-500 text-white' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                title={confirmDeleteId === selectedMeeting.id ? "点击确认删除" : "删除存档"}
              >
                {confirmDeleteId === selectedMeeting.id ? <span className="text-xs font-bold px-1">确认删除?</span> : <Trash2 className="w-4 h-4" />}
              </button>
            </header>

            <section>
              <h3 className="font-display text-sm font-bold uppercase mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> 常规报告摘要
              </h3>
              <div className="bg-[var(--theme-card-bg)] border-2 border-[var(--theme-border)] p-4 font-serif text-sm leading-relaxed whitespace-pre-wrap min-h-[100px]">
                {selectedMeeting.regularReport || '本期无常规报告记录。'}
              </div>
            </section>

            <section>
              <h3 className="font-display text-sm font-bold uppercase mb-3 flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" /> 经表决通过的议案 ({passedIssues.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {passedIssues.length === 0 ? (
                  <p className="text-xs font-mono opacity-60 italic col-span-full">无通过议案</p>
                ) : (
                  passedIssues.map(issue => (
                    <div 
                      key={issue.id} 
                      onClick={() => onOpenDetail(issue)}
                      className="bg-[var(--theme-card-bg)] border-2 border-[var(--theme-border)] p-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_var(--theme-border)] transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-[var(--theme-border)] bg-[var(--theme-accent-light)]">
                          {issue.status === 'completed' ? '已归档' : issue.status === 'execution' ? '执行中' : issue.status === 'authorization' ? '授权中' : '已通过'}
                        </span>
                        {issue.votes && (
                          <span className="font-mono text-[9px] text-green-600 font-bold border border-green-600 px-1">
                            {issue.votes.approve} 赞同
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif font-bold text-sm mb-1">{issue.title}</h4>
                      <p className="font-mono text-[10px] opacity-70 line-clamp-2">{issue.description || '无描述'}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="font-display text-sm font-bold uppercase mb-3 flex items-center gap-2 text-red-700">
                <XCircle className="w-4 h-4" /> 经表决否决的议案 ({rejectedIssues.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rejectedIssues.length === 0 ? (
                  <p className="text-xs font-mono opacity-60 italic col-span-full">无否决议案</p>
                ) : (
                  rejectedIssues.map(issue => (
                    <div 
                      key={issue.id} 
                      onClick={() => onOpenDetail(issue)}
                      className="bg-[var(--theme-card-bg)] border-2 border-red-200 p-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_#ef4444] transition-all opacity-80"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-red-600 bg-red-50 text-red-700">
                          已否决
                        </span>
                        {issue.votes && (
                          <span className="font-mono text-[9px] text-red-600 font-bold border border-red-600 px-1">
                            {issue.votes.reject} 否决
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif font-bold text-sm mb-1">{issue.title}</h4>
                      <p className="font-mono text-[10px] opacity-70 line-clamp-2">{issue.description || '无描述'}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center font-mono text-sm opacity-50">
            请在左侧选择会期以查看详情
          </div>
        )}
      </div>
    </div>
  );
};
