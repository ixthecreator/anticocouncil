import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Issue, Status, Member } from '../types';
import { CheckSquare, ArrowRight, Shield, PlayCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

interface PostMeetingViewProps {
  issues: Issue[];
  members: Member[];
  onUpdateIssue: (issue: Issue) => void;
  onOpenDetail: (issue: Issue) => void;
}

export const PostMeetingView: React.FC<PostMeetingViewProps> = ({
  issues,
  members,
  onUpdateIssue,
  onOpenDetail
}) => {
  const postMeetingStatuses: Status[] = ['passed', 'authorization', 'execution'];
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIssueIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getIssuesByStatus = (status: Status) => {
    return issues.filter(i => i.status === status && !i.archived);
  };

  const getStatusConfig = (status: Status) => {
    switch(status) {
      case 'passed': return { title: '已通过 (等待授权)', icon: CheckSquare, color: 'border-green-600', bg: 'bg-green-50', text: 'text-green-700' };
      case 'authorization': return { title: '授权层 (Authorization)', icon: Shield, color: 'border-amber-600', bg: 'bg-amber-50', text: 'text-amber-700' };
      case 'execution': return { title: '执行层 (Execution)', icon: PlayCircle, color: 'border-blue-600', bg: 'bg-blue-50', text: 'text-blue-700' };
      case 'completed': return { title: '归档完成', icon: CheckSquare, color: 'border-[var(--theme-border)]', bg: 'bg-[var(--theme-accent-light)]', text: 'text-[var(--theme-text-primary)]' };
      default: return { title: status, icon: CheckSquare, color: 'border-neutral-200', bg: 'bg-neutral-50', text: 'text-neutral-500' };
    }
  };

  const handleStatusChange = (issue: Issue, newStatus: Status) => {
    onUpdateIssue({ ...issue, status: newStatus });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      {postMeetingStatuses.map(status => {
        const config = getStatusConfig(status);
        const columnIssues = getIssuesByStatus(status);
        const Icon = config.icon;

        return (
          <div key={status} className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md flex flex-col min-h-[500px]">
            <div className={`p-3 border-b-2 border-[var(--theme-border,#171717)] flex items-center justify-between ${config.bg} ${config.text}`}>
              <h3 className="font-display text-sm font-bold tracking-wider uppercase flex items-center gap-1.5">
                <Icon className="w-4 h-4" />
                <span>{config.title}</span>
              </h3>
              <span className="font-mono text-xs font-bold px-1.5 py-0.5 border border-current">
                {columnIssues.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {columnIssues.length === 0 ? (
                <div className="text-[10px] font-mono text-[var(--theme-text-secondary,#525252)] italic text-center py-6 border border-dashed border-[var(--theme-border,#171717)]/30">
                  无相关议案
                </div>
              ) : (
                  columnIssues.map(issue => {
                      const isExpanded = expandedIssueIds.has(issue.id);
                      const isExecution = status === 'execution';
                      return (
                        <div 
                          key={issue.id}
                      className={`p-3 border-2 transition-colors cursor-pointer bg-[var(--theme-card-bg,#ffffff)] ${config.color}`}
                      onClick={() => onOpenDetail(issue)}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className={`self-start px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold border ${
                            issue.priority === 'urgent' ? 'bg-red-600 text-white border-red-600' :
                            issue.priority === 'high' ? 'bg-neutral-900 text-white border-neutral-900' :
                            issue.priority === 'medium' ? 'bg-neutral-200 text-neutral-800 border-neutral-300' :
                            'bg-white text-neutral-500 border-neutral-200'
                          }`}>
                            {issue.priority === 'urgent' ? '紧急' : issue.priority === 'high' ? '高' : issue.priority === 'medium' ? '中' : '低'}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] font-mono text-[var(--theme-text-secondary)]">
                            <Calendar className="w-3 h-3" />
                            {issue.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        {issue.signature && (
                          <span className="text-[10px] font-mono text-[var(--theme-text-primary)] border border-[var(--theme-border)] px-1 py-0.5 whitespace-nowrap">
                            {issue.signature}
                          </span>
                        )}
                      </div>
                      
                      <h4 className="font-serif font-bold text-sm text-[var(--theme-text-primary)] leading-tight mb-2">
                        {issue.serialNumber ? `[${issue.serialNumber}] ` : ''}{issue.title}
                      </h4>

                      {isExecution && (
                        <div className="mt-2" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={(e) => toggleExpand(issue.id, e)}
                            className="flex items-center gap-1 text-[10px] font-mono text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExpanded ? '收起详情' : '展示更多'}
                          </button>
                          
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-[var(--theme-border)]/20 space-y-2">
                              {issue.description && (
                                <div>
                                  <h5 className="text-[9px] font-mono uppercase text-[var(--theme-text-secondary)] mb-1">议案描述</h5>
                                  <p className="text-xs font-serif text-[var(--theme-text-primary)] whitespace-pre-wrap leading-relaxed">{issue.description}</p>
                                </div>
                              )}
                              {issue.discussion && (
                                <div>
                                  <h5 className="text-[9px] font-mono uppercase text-[var(--theme-text-secondary)] mb-1">讨论与附注</h5>
                                  <p className="text-xs font-serif text-[var(--theme-text-primary)] whitespace-pre-wrap leading-relaxed">{issue.discussion}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick Move Actions */}
                      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-[var(--theme-border)]/20" onClick={e => e.stopPropagation()}>
                        {status === 'passed' && (
                          <button onClick={() => handleStatusChange(issue, 'authorization')} className="flex-1 py-1 text-[9px] font-mono font-bold uppercase border border-[var(--theme-border)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-accent-text)] transition-colors">
                            移交授权
                          </button>
                        )}
                        {status === 'authorization' && (
                          <button onClick={() => handleStatusChange(issue, 'execution')} className="flex-1 py-1 text-[9px] font-mono font-bold uppercase border border-[var(--theme-border)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-accent-text)] transition-colors">
                            下发执行
                          </button>
                        )}
                        {status === 'execution' && (
                          <button onClick={() => handleStatusChange(issue, 'completed')} className="flex-1 py-1 text-[9px] font-mono font-bold uppercase border border-[var(--theme-border)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-accent-text)] transition-colors">
                            标记完成
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
