import { cn } from '@/lib/utils';

export default function Badge({ variant = 'default', children, className, size = 'sm' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    purple: 'bg-violet-50 text-violet-700 border-violet-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-md border',
        variants[variant] || variants.default,
        sizes[size] || sizes.sm,
        className
      )}
    >
      {children}
    </span>
  );
}
