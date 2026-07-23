import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ParliamentChartProps {
  approve: number;
  reject: number;
  abstain: number;
}

export const ParliamentChart: React.FC<ParliamentChartProps> = ({ approve, reject, abstain }) => {
  const data = [
    { name: '赞同 (Approve)', value: approve, color: '#16a34a' }, // green-600
    { name: '弃权 (Abstain)', value: abstain, color: '#a3a3a3' }, // neutral-400
    { name: '否决 (Reject)', value: reject, color: '#dc2626' }, // red-600
  ].filter(d => d.value > 0);

  // If no votes, show an empty placeholder pie
  const displayData = data.length > 0 ? data : [{ name: '无表决', value: 1, color: '#e5e5e5' }];

  return (
    <div className="w-full h-48 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={displayData}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius="60%"
            outerRadius="100%"
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {displayData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          {data.length > 0 && <Tooltip contentStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />}
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-2">
        <span className="text-2xl font-display font-bold text-[var(--theme-text-primary)]">
          {approve + reject + abstain}
        </span>
        <span className="text-[10px] font-mono text-[var(--theme-text-secondary)]">总票数</span>
      </div>
    </div>
  );
};
