import { cn } from '@/lib/utils';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}) {
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-500/20',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200',
    outline: 'bg-transparent text-slate-600 hover:bg-slate-50 border border-slate-300',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  const sizes = {
    xs: 'text-xs px-2 py-1.5 gap-1',
    sm: 'text-sm px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-1.5',
    lg: 'text-base px-6 py-2.5 gap-2',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg transition-smooth disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
