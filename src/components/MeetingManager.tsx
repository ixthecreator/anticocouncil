import React, { useState } from 'react';
import { Meeting, Issue, Member } from '../types';
import { Plus } from 'lucide-react';

interface MeetingManagerProps {
  meetings: Meeting[];
  issues: Issue[];
  members: Member[];
  currentMeetingId: string | null;
  onSelectMeeting: (id: string | null) => void;
  onAddMeeting: (meeting: Meeting) => void;
  onUpdateMeetingSummary: (id: string, summary: string) => void;
  onDeleteMeeting: (id: string) => void;
}

export const MeetingManager: React.FC<MeetingManagerProps> = ({
  onAddMeeting,
}) => {
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDate, setNewMeetingDate] = useState(new Date().toISOString().split('T')[0]);

  const getWeekdayCN = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekdays[date.getDay()];
  };

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date(newMeetingDate);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const title = newMeetingTitle.trim() || `${year}年${month}月${day}日例会`;
    const newMeeting: Meeting = {
      id: `meeting-${Date.now()}`,
      title,
      week: getWeekdayCN(newMeetingDate),
      date: newMeetingDate,
      summary: '',
      regularReport: '', 
      createdAt: new Date().toISOString(),
      issueIds: [],
    };

    onAddMeeting(newMeeting);
    setNewMeetingTitle('');
  };

  return (
    <div className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-4 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
        <h3 className="font-display text-sm font-bold tracking-wider uppercase text-[var(--theme-text-primary,#171717)] flex items-center gap-2">
          召开新例会
        </h3>
      </div>

      <form onSubmit={handleCreateMeeting} className="p-3 border-2 border-[var(--theme-border,#171717)] space-y-3 bg-[var(--theme-card-bg,#ffffff)] flex-1">
        <div>
          <label className="block text-[10px] font-mono text-[var(--theme-text-secondary,#525252)] uppercase mb-0.5">例会存档名称</label>
          <input
            type="text"
            value={newMeetingTitle}
            onChange={(e) => setNewMeetingTitle(e.target.value)}
            className="w-full px-2 py-1 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none"
            placeholder={`例如: ${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}日例会`}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-[var(--theme-text-secondary,#525252)] uppercase mb-0.5">召开日期</label>
          <input
            type="date"
            value={newMeetingDate}
            onChange={(e) => setNewMeetingDate(e.target.value)}
            className="w-full px-2 py-1 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 mt-4 bg-[var(--theme-accent,#171717)] text-[var(--theme-accent-text,#ffffff)] font-mono text-xs hover:opacity-90 transition-opacity cursor-pointer font-bold flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> 确立新例会周期
        </button>
      </form>
    </div>
  );
};
