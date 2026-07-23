import React, { useState } from 'react';
import { Meeting, Issue, Status } from '../types';
import { Eye, Clock, Calendar, CheckCircle } from 'lucide-react';

interface SupervisionViewProps {
  meetings: Meeting[];
  issues: Issue[];
  onOpenDetail: (issue: Issue) => void;
}

export const SupervisionView: React.FC<SupervisionViewProps> = ({ meetings, issues, onOpenDetail }) => {
  const [subTab, setSubTab] = useState<'current' | 'overview'>('current');
  const [recentN, setRecentN] = useState<number>(3);

  // For "当前活动": Issues that are in 'authorization' (未执行), 'passed', or 'execution' (执行中)
  const supervisionIssues = issues.filter(i => i.status === 'passed' || i.status === 'authorization' || i.status === 'execution');

  const pendingAuth = supervisionIssues.filter(i => i.status === 'passed' || i.status === 'authorization');
  const executing = supervisionIssues.filter(i => i.status === 'execution');

  // For "活动总览": Select recent N meetings, show all "passed" or "completed" or "execution" or "authorization"
  // "所有通过的活动": meaning anything that is not rejected or agenda/voting? 
  // Let's assume passed, authorization, execution, completed.
  const sortedMeetings = [...meetings].sort((a, b) => b.id.localeCompare(a.id));
  const overviewMeetings = sortedMeetings.slice(0, recentN);
  const overviewMeetingIds = overviewMeetings.map(m => m.id);
  const overviewIssues = issues.filter(i => 
    overviewMeetingIds.includes(i.meetingId || '') && 
    (i.status === 'passed' || i.status === 'authorization' || i.status === 'execution' || i.status === 'completed')
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Sub-navigation */}
      <div className="lg:col-span-3 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md flex flex-col p-4 space-y-2">
        <button
          onClick={() => setSubTab('current')}
          className={`w-full text-left p-3 border-2 transition-all font-sans font-bold text-sm ${
            subTab === 'current'
              ? 'border-[var(--theme-border,#171717)] bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)]'
              : 'border-transparent bg-transparent text-[var(--theme-text-primary)] hover:border-[var(--theme-border,#171717)]'
          }`}
        >
          当前议程
        </button>
        <button
          onClick={() => setSubTab('overview')}
          className={`w-full text-left p-3 border-2 transition-all font-sans font-bold text-sm ${
            subTab === 'overview'
              ? 'border-[var(--theme-border,#171717)] bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)]'
              : 'border-transparent bg-transparent text-[var(--theme-text-primary)] hover:border-[var(--theme-border,#171717)]'
          }`}
        >
          议程总览
        </button>
      </div>

      {/* Right Column: Content */}
      <div className="lg:col-span-9 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-6 min-h-[500px]">
        {subTab === 'current' && (
          <div className="space-y-6">
            <h2 className="font-serif text-2xl font-bold border-b-2 border-[var(--theme-border)] pb-2 flex items-center gap-2 text-[var(--theme-text-primary)]">
              <Clock className="w-5 h-5" /> 当前议程督办
            </h2>
            <p className="text-[10px] font-mono text-[var(--theme-text-secondary)]">
              * 督办全系统所有未完成、执行中的议案。标记完成后将自动归入其对应的周期档案中。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold tracking-widest uppercase bg-[var(--theme-accent-light)] px-3 py-1.5 border border-[var(--theme-border)] text-red-700">
                  待执行 / 待授权 ({pendingAuth.length})
                </h3>
                {pendingAuth.map(issue => (
                  <div key={issue.id} onClick={() => onOpenDetail(issue)} className="p-3 border-2 border-neutral-200 bg-[var(--theme-card-bg)] hover:border-[var(--theme-border)] cursor-pointer transition-all">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-[9px] px-1 bg-red-100 text-red-800 border border-red-300">
                        {issue.category}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--theme-text-secondary)]">经办: {issue.signature || '待定'}</span>
                    </div>
                    <h4 className="font-bold text-sm text-[var(--theme-text-primary)]">{issue.serialNumber ? `[${issue.serialNumber}] ` : ''}{issue.title}</h4>
                    <p className="text-xs text-[var(--theme-text-secondary)] mt-1 line-clamp-2">{issue.description || '无详细描述'}</p>
                  </div>
                ))}
                {pendingAuth.length === 0 && <p className="text-xs font-mono opacity-50 italic">暂无记录</p>}
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold tracking-widest uppercase bg-[var(--theme-accent-light)] px-3 py-1.5 border border-[var(--theme-border)] text-blue-700">
                  执行中 ({executing.length})
                </h3>
                {executing.map(issue => (
                  <div key={issue.id} onClick={() => onOpenDetail(issue)} className="p-3 border-2 border-neutral-200 bg-[var(--theme-card-bg)] hover:border-[var(--theme-border)] cursor-pointer transition-all">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-[9px] px-1 bg-blue-100 text-blue-800 border border-blue-300">
                        {issue.category}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--theme-text-secondary)]">经办: {issue.signature || '待定'}</span>
                    </div>
                    <h4 className="font-bold text-sm text-[var(--theme-text-primary)]">{issue.serialNumber ? `[${issue.serialNumber}] ` : ''}{issue.title}</h4>
                    <p className="text-xs text-[var(--theme-text-secondary)] mt-1 line-clamp-2">{issue.description || '无详细描述'}</p>
                  </div>
                ))}
                {executing.length === 0 && <p className="text-xs font-mono opacity-50 italic">暂无记录</p>}
              </div>
            </div>
          </div>
        )}

        {subTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b-2 border-[var(--theme-border)] pb-2">
              <h2 className="font-serif text-2xl font-bold flex items-center gap-2 text-[var(--theme-text-primary)]">
                <Eye className="w-5 h-5" /> 议程总览
              </h2>
              <div className="flex items-center gap-2 text-sm font-mono text-[var(--theme-text-primary)]">
                <label>追溯近</label>
                <input 
                  type="number" 
                  min="1" 
                  max="20" 
                  value={recentN} 
                  onChange={(e) => setRecentN(Number(e.target.value))} 
                  className="w-12 text-center border-b-2 border-[var(--theme-border)] bg-transparent outline-none focus:border-[var(--theme-accent)] transition-colors"
                />
                <label>次会议</label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overviewIssues.length === 0 ? (
                <p className="text-xs font-mono opacity-50 italic col-span-full">暂无通过的活动</p>
              ) : (
                overviewIssues.map(issue => {
                  const issueMeeting = meetings.find(m => m.id === issue.meetingId);
                  return (
                    <div key={issue.id} onClick={() => onOpenDetail(issue)} className="p-3 border-2 border-neutral-200 bg-[var(--theme-card-bg)] hover:border-[var(--theme-border)] cursor-pointer transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`font-mono text-[9px] px-1.5 py-0.5 border ${
                            issue.status === 'completed' ? 'border-green-600 bg-green-50 text-green-700' :
                            issue.status === 'execution' ? 'border-blue-600 bg-blue-50 text-blue-700' :
                            'border-neutral-600 bg-neutral-50 text-neutral-700'
                          }`}>
                            {issue.status === 'completed' ? '归档' : issue.status === 'execution' ? '执行' : '未执行'}
                          </span>
                          <span className="font-mono text-[9px] text-[var(--theme-text-secondary)]">
                            {issueMeeting ? issueMeeting.date : '无周期'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-[var(--theme-text-primary)] mb-1">{issue.serialNumber ? `[${issue.serialNumber}] ` : ''}{issue.title}</h4>
                      </div>
                      <p className="font-mono text-[10px] text-[var(--theme-text-secondary)] mt-2">
                        {issue.category} | {issue.signature || '待定'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
