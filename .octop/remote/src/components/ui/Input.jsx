import { cn } from '@/lib/utils';

export default function Input({ label, error, className, ...props }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}
      <input
        className={cn(
          'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth',
          error && 'border-red-400 focus:ring-red-500/40 focus:border-red-400',
          'placeholder:text-slate-400'
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
