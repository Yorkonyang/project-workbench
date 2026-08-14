import { cn } from '@/lib/utils';

export default function PageContainer({ children, className, title, subtitle, action }) {
  return (
    <div className={cn('page-content animate-fade-in-up', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-6">
          {title && (
            <div>
              <h2 className="text-xl font-bold text-slate-800">{title}</h2>
              {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
