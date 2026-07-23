import React, { useState } from 'react';
import { ActivityEvent } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface ActivityViewProps {
  activities: ActivityEvent[];
  onAddActivity: (activity: ActivityEvent) => void;
  onDeleteActivity: (id: string) => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  activities,
  onAddActivity,
  onDeleteActivity,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [name, setName] = useState('');
  const [participants, setParticipants] = useState('');

  const handleAdd = () => {
    if (!name || !time) return;
    onAddActivity({
      id: Date.now().toString(),
      time,
      organizer,
      name,
      participants,
    });
    setTime('');
    setOrganizer('');
    setName('');
    setParticipants('');
    setIsAdding(false);
  };

  return (
    <div className="border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md p-6 min-h-[600px]">
      <div className="flex justify-between items-center border-b-2 border-[var(--theme-border)] pb-4 mb-6">
        <h2 className="font-serif text-3xl font-bold text-[var(--theme-text-primary)]">独立活动</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--theme-border)] bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-sans text-sm font-bold hover:opacity-90 transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增活动
        </button>
      </div>

      {isAdding && (
        <div className="mb-6 p-4 border-2 border-[var(--theme-border)] bg-[var(--theme-card-bg)] space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono mb-1 text-[var(--theme-text-secondary)]">时间</label>
              <input
                type="text"
                value={time}
                onChange={e => setTime(e.target.value)}
                placeholder="例如：2026-08-01 14:00"
                className="w-full px-3 py-2 border-2"
              />
            </div>
            <div>
              <label className="block text-xs font-mono mb-1 text-[var(--theme-text-secondary)]">活动名</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="活动名称"
                className="w-full px-3 py-2 border-2"
              />
            </div>
            <div>
              <label className="block text-xs font-mono mb-1 text-[var(--theme-text-secondary)]">活动举办者</label>
              <input
                type="text"
                value={organizer}
                onChange={e => setOrganizer(e.target.value)}
                placeholder="举办者"
                className="w-full px-3 py-2 border-2"
              />
            </div>
            <div>
              <label className="block text-xs font-mono mb-1 text-[var(--theme-text-secondary)]">参与或协助社团/组织</label>
              <input
                type="text"
                value={participants}
                onChange={e => setParticipants(e.target.value)}
                placeholder="参与/协助社团或组织"
                className="w-full px-3 py-2 border-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 font-mono text-sm"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-mono text-sm border-2 border-[var(--theme-border)] hover:opacity-90"
            >
              保存
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activities.map(act => (
          <div key={act.id} className="p-4 border-2 border-[var(--theme-border)] bg-[var(--theme-card-bg)] flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 text-[var(--theme-text-primary)]">{act.name}</h3>
              <div className="space-y-1 text-sm font-sans text-[var(--theme-text-secondary)]">
                <p><strong>时间:</strong> {act.time}</p>
                <p><strong>举办者:</strong> {act.organizer}</p>
                <p><strong>参与/协助:</strong> {act.participants}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  if (confirmDeleteId === act.id) {
                    onDeleteActivity(act.id);
                    setConfirmDeleteId(null);
                  } else {
                    setConfirmDeleteId(act.id);
                    setTimeout(() => setConfirmDeleteId(null), 3000);
                  }
                }}
                className={`p-1 transition-colors border ${confirmDeleteId === act.id ? 'border-red-500 bg-red-500 text-white' : 'text-red-500 hover:bg-red-50 border-transparent hover:border-red-200'}`}
                title={confirmDeleteId === act.id ? "点击确认删除" : "删除活动"}
              >
                {confirmDeleteId === act.id ? <span className="text-xs font-bold px-1">确认删除?</span> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
        {activities.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center text-[var(--theme-text-secondary)] font-mono text-sm opacity-50">
            暂无独立活动记录
          </div>
        )}
      </div>
    </div>
  );
};
