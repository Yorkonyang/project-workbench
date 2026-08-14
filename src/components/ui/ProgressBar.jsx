import { cn } from '@/lib/utils';

export default function ProgressBar({ value, max = 100, color = '#6366F1', showLabel = true, size = 'md' }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{percent.toFixed(0)}%</span>
          <span className="font-mono">{value}/{max}</span>
        </div>
      )}
      <div className={cn('w-full bg-slate-100 rounded-full overflow-hidden', heights[size])}>
        <div
          className={cn('rounded-full transition-all duration-500 ease-out', heights[size])}
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
