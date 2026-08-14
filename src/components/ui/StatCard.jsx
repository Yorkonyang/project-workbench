import { cn } from '@/lib/utils';

const ACCENT_COLORS = {
  '#3b82f6': 'border-l-blue-500',
  '#6366f1': 'border-l-indigo-500',
  '#14b8a6': 'border-l-teal-500',
  '#ef4444': 'border-l-red-500',
  '#f59e0b': 'border-l-amber-500',
  '#8b5cf6': 'border-l-violet-500',
};

export default function StatCard({ icon: Icon, label, value, sublabel, color = '#6366F1', trend, onClick }) {
  const accentClass = ACCENT_COLORS[color] || 'border-l-indigo-500';

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-4 transition-smooth border-l-4',
        accentClass,
        onClick && 'cursor-pointer hover:shadow-md hover:border-slate-300'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p
            className="data-number text-3xl text-slate-800 leading-none"
            style={{ color }}
          >
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-slate-400 mt-1.5 font-mono">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3"
            style={{ backgroundColor: `${color}12` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
          <span className={cn('text-xs font-semibold', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
          <span className="text-xs text-slate-400 ml-1">较上周</span>
        </div>
      )}
    </div>
  );
}
