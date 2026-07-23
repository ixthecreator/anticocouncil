import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Meeting, Issue, Status } from '../types';
import { ParliamentChart } from './ParliamentChart';
import { Play, Check, X, Hand, AlertTriangle, BookOpen, Plus, Save } from 'lucide-react';

interface SessionViewProps {
  currentMeeting: Meeting | null;
  issues: Issue[];
  onUpdateMeetingRegularReport: (id: string, report: string) => void;
  onUpdateIssue: (issue: Issue) => void;
  onAddIssue: (status: Status) => void; // modified to open modal
}

export const SessionView: React.FC<SessionViewProps> = ({
  currentMeeting,
  issues,
  onUpdateMeetingRegularReport,
  onUpdateIssue,
  onAddIssue
}) => {
  const [activeVotingIssueId, setActiveVotingIssueId] = useState<string | null>(null);

  if (!currentMeeting) {
    return (
      <div className="text-center py-16 bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md border-2 border-dashed border-[var(--theme-border,#171717)] flex flex-col items-center justify-center gap-3 text-[var(--theme-text-primary,#171717)]">
        <AlertTriangle className="w-8 h-8 text-[var(--theme-text-secondary,#525252)]" />
        <h3 className="font-serif text-lg font-bold">暂无活跃的例会周期</h3>
        <p className="text-xs font-mono text-[var(--theme-text-secondary,#525252)] max-w-sm">
          为了开启协同，请在顶部 “例会周期管理” 中确立一个活跃例会周期。
        </p>
      </div>
    );
  }

  const meetingIssues = issues.filter(i => i.meetingId === currentMeeting.id && !i.archived);
  const agendaIssues = meetingIssues.filter(i => i.status === 'agenda');
  const votingIssues = meetingIssues.filter(i => i.status === 'voting');

  // Currently active voting issue
  const activeIssue = issues.find(i => i.id === activeVotingIssueId) || votingIssues[0] || null;

  const handleStartVoting = (issue: Issue) => {
    onUpdateIssue({
      ...issue,
      status: 'voting',
      votes: { approve: 0, reject: 0, abstain: 0 },
      voteRule: 'simple'
    });
    setActiveVotingIssueId(issue.id);
  };

  const handleVote = (type: 'approve' | 'reject' | 'abstain', increment: boolean) => {
    if (!activeIssue || !activeIssue.votes) return;
    const currentVal = activeIssue.votes[type] || 0;
    const newVal = increment ? currentVal + 1 : Math.max(0, currentVal - 1);
    
    onUpdateIssue({
      ...activeIssue,
      votes: {
        ...activeIssue.votes,
        [type]: newVal
      }
    });
  };

  const handleChangeRule = (rule: 'simple' | 'absolute') => {
    if (!activeIssue) return;
    onUpdateIssue({ ...activeIssue, voteRule: rule });
  };

  const handleConcludeVoting = (forceStatus?: 'passed' | 'rejected') => {
    if (!activeIssue || !activeIssue.votes) return;
    
    let finalStatus: Status = 'rejected';
    
    if (forceStatus) {
      finalStatus = forceStatus;
    } else {
      const { approve, reject, abstain } = activeIssue.votes;
      const totalVotes = approve + reject + abstain;
      
      if (activeIssue.voteRule === 'absolute') {
        // Absolute majority: approve must be > half of the total voting participants
        finalStatus = approve > (totalVotes / 2) ? 'passed' : 'rejected';
      } else {
        // Simple majority: approve > reject (ignores abstains)
        finalStatus = approve > reject ? 'passed' : 'rejected';
      }
    }

    onUpdateIssue({
      ...activeIssue,
      status: finalStatus
    });
    setActiveVotingIssueId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Report & Agenda List */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Regular Report */}
        <div className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-4 space-y-4 text-[var(--theme-text-primary,#171717)]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span>会议中报告记录</span>
            </h3>
            <span className="text-[10px] font-mono text-[var(--theme-text-secondary,#525252)]">随时保存</span>
          </div>
          <div className="space-y-2">
            <textarea
              value={currentMeeting.regularReport || ''}
              onChange={(e) => onUpdateMeetingRegularReport(currentMeeting.id, e.target.value)}
              placeholder="在此录入本周例会常规报告内容，如固定进度、日常行政报告等..."
              rows={8}
              className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-serif text-xs focus:outline-none focus:bg-[var(--theme-accent-light,rgba(0,0,0,0.03))] leading-relaxed transition-colors"
            />
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const getWeekdayCN = (dateStr: string): string => {
                    if (!dateStr) return '';
                    const date = new Date(dateStr);
                    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                    return weekdays[date.getDay()];
                  };
                  
                  const completedIssues = meetingIssues.filter((i) => i.status === 'completed');
                  const activeIssues = meetingIssues.filter((i) => i.status !== 'completed');

                  let brief = `========================================\n`;
                  brief += `【${currentMeeting.title} 回顾简报】\n`;
                  brief += ` 日期: ${currentMeeting.date} (${currentMeeting.week})\n`;
                  brief += `========================================\n\n`;

                  brief += `一、 常规报告与大纲 (OVERVIEW)\n`;
                  brief += `  ${currentMeeting.regularReport || currentMeeting.summary || '未录入常规报告。'}\n\n`;

                  brief += `二、 本期已归档完成议题 (RESOLVED - ${completedIssues.length} 项)\n`;
                  if (completedIssues.length === 0) {
                    brief += `  - 暂无已归档完成项\n`;
                  } else {
                    completedIssues.forEach((issue, index) => {
                      brief += `  [${index + 1}] 《${issue.serialNumber ? `[${issue.serialNumber}] ` : ''}${issue.title}》\n`;
                      brief += `      类别: ${issue.category} | 优先度: ${issue.priority.toUpperCase()}\n`;
                      brief += `      执行落款: ${issue.signature}\n`;
                      if (issue.discussion) {
                        brief += `      会商结论: ${issue.discussion}\n`;
                      }
                      brief += `\n`;
                    });
                  }

                  brief += `三、 本期推进中议题 (IN PROGRESS/TODO - ${activeIssues.length} 项)\n`;
                  if (activeIssues.length === 0) {
                    brief += `  - 所有议题均已归档销号。\n`;
                  } else {
                    activeIssues.forEach((issue, index) => {
                      const statusMap: Record<Status, string> = {
                        agenda: '议程',
                        voting: '表决中',
                        passed: '已通过',
                        rejected: '已否决',
                        authorization: '授权',
                        execution: '执行',
                        completed: '归档完成'
                      };
                      brief += `  * 《${issue.serialNumber ? `[${issue.serialNumber}] ` : ''}${issue.title}》 [${statusMap[issue.status] || '处理中'}]\n`;
                      brief += `      类别: ${issue.category} | 优先度: ${issue.priority.toUpperCase()} | 承办落款: ${issue.signature || '待指派'}\n`;
                    });
                  }

                  brief += `========================================\n`;
                  brief += `落款鉴印：${completedIssues.map(i => i.signature).filter((v, idx, a) => v && a.indexOf(v) === idx).join(', ') || '全体参会成员'}\n`;
                  brief += `生成时刻: ${new Date().toLocaleString('zh-CN')}\n`;
                  
                  const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `回顾简报_${currentMeeting.date}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 border border-[var(--theme-border)] text-xs font-mono bg-[var(--theme-accent-light)] hover:bg-[var(--theme-border)] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>生成并导出 txt 简报</span>
              </button>
            </div>
          </div>
        </div>

        {/* Agenda List */}
        <div className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-4 space-y-4 text-[var(--theme-text-primary,#171717)]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase flex items-center gap-1.5">
              <span>待议议程 (Agenda)</span>
            </h3>
            <button
              onClick={() => onAddIssue('agenda')}
              className="px-2 py-1 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)] font-mono text-[10px] font-bold flex items-center gap-1 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>提交新议题</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {agendaIssues.length === 0 ? (
              <p className="text-[10px] font-mono text-[var(--theme-text-secondary,#525252)] italic text-center py-4">无待议议程</p>
            ) : (
              <AnimatePresence>
                {agendaIssues.map(issue => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={issue.id} 
                    className="p-2 border-2 border-neutral-200 bg-[var(--theme-card-bg,#ffffff)] flex items-center justify-between hover:border-[var(--theme-border,#171717)] transition-colors"
                  >
                    <div>
                      <h4 className="font-sans text-xs font-bold">{issue.serialNumber ? `[${issue.serialNumber}] ` : ''}{issue.title}</h4>
                      <p className="font-mono text-[9px] text-[var(--theme-text-secondary,#525252)] mt-0.5">{issue.category} | 经办: {issue.signature || '待定'}</p>
                    </div>
                    <button
                      onClick={() => handleStartVoting(issue)}
                      className="p-1.5 bg-[var(--theme-accent-light,rgba(0,0,0,0.05))] border border-[var(--theme-border,#171717)] text-[var(--theme-text-primary)] hover:bg-[var(--theme-accent,#171717)] hover:text-[var(--theme-accent-text)] transition-colors cursor-pointer"
                      title="付诸表决"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Real-time Voting System */}
      <div className="lg:col-span-7">
        <div className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-6 space-y-6 text-[var(--theme-text-primary,#171717)] min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase flex items-center gap-1.5">
              <span>实时表决系统 (Voting)</span>
            </h3>
          </div>

          {!activeIssue ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 space-y-4">
              <div className="w-48 h-24 border-t-2 border-l-2 border-r-2 border-dashed border-[var(--theme-text-primary)] rounded-t-full flex items-end justify-center pb-2">
                <span className="font-mono text-[10px] uppercase">等待表决开始</span>
              </div>
              <p className="text-xs font-mono">从左侧议程列表中选择议案付诸表决</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Active Issue Header */}
              <div className="text-center space-y-2 mb-6">
                <span className="inline-block px-2 py-0.5 border border-red-500 bg-red-50 text-red-600 font-mono text-[9px] uppercase font-bold animate-pulse">
                  正在表决 (LIVE)
                </span>
                <h2 className="font-serif text-2xl font-bold">{activeIssue.serialNumber ? `[${activeIssue.serialNumber}] ` : ''}{activeIssue.title}</h2>
                <p className="text-xs text-[var(--theme-text-secondary)]">{activeIssue.description || '无详细描述'}</p>
                
                {/* Voting Rule Toggle */}
                <div className="inline-flex items-center border-2 border-[var(--theme-border,#171717)] p-0.5 mt-4 bg-[var(--theme-card-bg)]">
                  <button
                    onClick={() => handleChangeRule('simple')}
                    className={`px-3 py-1 font-mono text-[10px] uppercase cursor-pointer transition-colors ${activeIssue.voteRule === 'simple' ? 'bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text)] font-bold' : 'hover:bg-[var(--theme-accent-light)]'}`}
                  >
                    简单多数制 (赞成&gt;反对)
                  </button>
                  <button
                    onClick={() => handleChangeRule('absolute')}
                    className={`px-3 py-1 font-mono text-[10px] uppercase cursor-pointer transition-colors ${activeIssue.voteRule === 'absolute' ? 'bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text)] font-bold' : 'hover:bg-[var(--theme-accent-light)]'}`}
                  >
                    绝对多数制 (&gt;总数1/2)
                  </button>
                </div>
              </div>

              {/* Parliament Chart */}
              <div className="mb-6">
                <ParliamentChart 
                  approve={activeIssue.votes?.approve || 0} 
                  reject={activeIssue.votes?.reject || 0} 
                  abstain={activeIssue.votes?.abstain || 0} 
                />
              </div>

              {/* Vote Controls */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="flex flex-col items-center gap-2">
                  <span className="font-bold text-green-600 text-lg">{activeIssue.votes?.approve || 0}</span>
                  <div className="flex border-2 border-green-600 rounded bg-green-50 overflow-hidden">
                    <button onClick={() => handleVote('approve', false)} className="px-2 py-1 hover:bg-green-200 text-green-700 font-bold">-</button>
                    <div className="px-3 py-1 bg-green-600 text-white font-mono text-xs flex items-center gap-1">
                      <Check className="w-3 h-3"/> 赞同
                    </div>
                    <button onClick={() => handleVote('approve', true)} className="px-2 py-1 hover:bg-green-200 text-green-700 font-bold">+</button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="font-bold text-neutral-500 text-lg">{activeIssue.votes?.abstain || 0}</span>
                  <div className="flex border-2 border-neutral-400 rounded bg-neutral-50 overflow-hidden">
                    <button onClick={() => handleVote('abstain', false)} className="px-2 py-1 hover:bg-neutral-200 text-neutral-600 font-bold">-</button>
                    <div className="px-3 py-1 bg-neutral-400 text-white font-mono text-xs flex items-center gap-1">
                      <Hand className="w-3 h-3"/> 弃权
                    </div>
                    <button onClick={() => handleVote('abstain', true)} className="px-2 py-1 hover:bg-neutral-200 text-neutral-600 font-bold">+</button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="font-bold text-red-600 text-lg">{activeIssue.votes?.reject || 0}</span>
                  <div className="flex border-2 border-red-600 rounded bg-red-50 overflow-hidden">
                    <button onClick={() => handleVote('reject', false)} className="px-2 py-1 hover:bg-red-200 text-red-700 font-bold">-</button>
                    <div className="px-3 py-1 bg-red-600 text-white font-mono text-xs flex items-center gap-1">
                      <X className="w-3 h-3"/> 否决
                    </div>
                    <button onClick={() => handleVote('reject', true)} className="px-2 py-1 hover:bg-red-200 text-red-700 font-bold">+</button>
                  </div>
                </div>
              </div>

              {/* Conclude Controls */}
              <div className="mt-auto flex items-center justify-between border-t border-neutral-200 pt-4">
                <button
                  onClick={() => handleConcludeVoting()}
                  className="px-6 py-2 bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)] font-bold font-mono text-xs hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4"/>
                  结束表决并结算
                </button>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConcludeVoting('passed')}
                    className="px-3 py-1.5 border border-green-600 text-green-600 hover:bg-green-50 font-mono text-[10px] font-bold uppercase transition-colors cursor-pointer"
                    title="防止系统故障，强制标记为通过"
                  >
                    强制通过
                  </button>
                  <button
                    onClick={() => handleConcludeVoting('rejected')}
                    className="px-3 py-1.5 border border-red-600 text-red-600 hover:bg-red-50 font-mono text-[10px] font-bold uppercase transition-colors cursor-pointer"
                    title="防止系统故障，强制标记为否决"
                  >
                    强制否决
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
