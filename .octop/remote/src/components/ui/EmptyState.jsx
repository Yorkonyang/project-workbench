import { cn } from '@/lib/utils';

export default function EmptyState({ title, description, icon: Icon, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-slate-400" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 max-w-xs mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-smooth"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
