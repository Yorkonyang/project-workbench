import { Edit2, Trash2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import {
  getRiskSeverityConfig,
  getProjectColor,
  formatDate,
  cn,
} from '@/lib/utils';

const STATUS_CONFIG = {
  open: { label: '待处理', variant: 'danger' },
  mitigating: { label: '处理中', variant: 'warning' },
  closed: { label: '已关闭', variant: 'success' },
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function RiskList({ risks, projects, onEdit, onDelete }) {
  const sorted = [...risks].sort((a, b) => {
    if (a.status !== b.status) {
      const statusOrder = { open: 0, mitigating: 1, closed: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  if (sorted.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-8">暂无风险记录</div>;
  }

  return (
    <div className="space-y-2">
      {sorted.map((risk) => {
        const sevConfig = getRiskSeverityConfig(risk.severity);
        const statusConfig = STATUS_CONFIG[risk.status] || STATUS_CONFIG.open;
        const project = projects?.find((p) => p.id === risk.projectId);

        return (
          <div
            key={risk.id}
            className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-sm transition-all-smooth"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: sevConfig.color }}
                  />
                  <span className="text-sm font-medium text-slate-800">{risk.title}</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-2">{risk.description}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                  <Badge variant="default" className={sevConfig.bgClass + ' ' + sevConfig.textClass}>
                    严重度: {sevConfig.label}
                  </Badge>
                  {project && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getProjectColor(risk.projectId) }} />
                      {project.code}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">责任人: {risk.owner}</span>
                  <span className="text-xs text-slate-400">识别: {formatDate(risk.identifiedDate)}</span>
                </div>

                {risk.mitigation && (
                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded p-2">
                    <span className="font-medium">应对措施：</span>{risk.mitigation}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => onEdit?.(risk)}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete?.(risk)}
                  className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
