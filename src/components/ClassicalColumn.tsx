import React from 'react';

export const ClassicalColumn: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center select-none ${className}`}>
      {/* Elegantly styled Greek classical column or sculpture fragment in pure black/white vector */}
      <svg
        width="140"
        height="180"
        viewBox="0 0 140 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-neutral-900 stroke-neutral-900"
        style={{ strokeWidth: '1.2' }}
      >
        {/* Pediment / Capital (Top Part) */}
        <line x1="15" y1="20" x2="125" y2="20" stroke="currentColor" />
        <line x1="10" y1="25" x2="130" y2="25" stroke="currentColor" strokeWidth="2" />
        <rect x="20" y="29" width="100" height="8" stroke="currentColor" />
        
        {/* Volutes (Ionic capital swirls) */}
        <circle cx="28" cy="45" r="8" stroke="currentColor" />
        <circle cx="28" cy="45" r="4" stroke="currentColor" />
        <circle cx="112" cy="45" r="8" stroke="currentColor" />
        <circle cx="112" cy="45" r="4" stroke="currentColor" />
        <line x1="28" y1="37" x2="112" y2="37" stroke="currentColor" />
        <line x1="36" y1="45" x2="104" y2="45" stroke="currentColor" />

        {/* Column Shaft Fluting (The grid lines) */}
        <line x1="38" y1="53" x2="38" y2="140" stroke="currentColor" />
        <line x1="51" y1="53" x2="51" y2="140" stroke="currentColor" />
        <line x1="64" y1="53" x2="64" y2="140" stroke="currentColor" />
        <line x1="76" y1="53" x2="76" y2="140" stroke="currentColor" />
        <line x1="89" y1="53" x2="89" y2="140" stroke="currentColor" />
        <line x1="102" y1="53" x2="102" y2="140" stroke="currentColor" />

        {/* Break line simulating a classical fragment or ruin */}
        <path
          d="M 38 100 L 48 105 L 53 98 L 65 106 L 72 95 L 85 102 L 95 90 L 102 96"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.5"
        />

        {/* Base (Bottom Part) */}
        <line x1="30" y1="140" x2="110" y2="140" stroke="currentColor" strokeWidth="2" />
        <rect x="25" y="144" width="90" height="8" stroke="currentColor" />
        <rect x="15" y="154" width="110" height="12" stroke="currentColor" />
        
        {/* Ground lines */}
        <line x1="5" y1="172" x2="135" y2="172" stroke="currentColor" />
        <line x1="25" y1="176" x2="115" y2="176" stroke="currentColor" />
      </svg>
      <div className="mt-6 font-display text-xs tracking-[0.2em] text-neutral-400 uppercase">
        无事发生占位符
      </div>
      <div className="mt-2 font-serif text-xs italic text-neutral-400">
        "状态：一切井然有序 (Pristine Grid)"
      </div>
    </div>
  );
};
