import { cn } from '@/lib/utils';

export default function Card({ title, subtitle, children, className, titleIcon: TitleIcon, action, headerClass }) {
  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl', className)}>
      {title && (
        <div className={cn('px-5 py-4 border-b border-slate-100 flex items-center justify-between', headerClass)}>
          <div className="flex items-center gap-2.5">
            {TitleIcon && (
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                <TitleIcon className="w-4 h-4 text-primary-600" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
