import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { getRiskSeverityConfig, getProjectColor } from '@/lib/utils';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function RiskSummary({ risks, projects }) {
  const sorted = [...risks].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const openCount = risks.filter((r) => r.status === 'open').length;
  const mitigatingCount = risks.filter((r) => r.status === 'mitigating').length;

  return (
    <Card
      title="风险概览"
      actions={
        <div className="flex gap-2 text-xs">
          <Badge variant="danger">{openCount} 待处理</Badge>
          <Badge variant="warning">{mitigatingCount} 处理中</Badge>
        </div>
      }
    >
      <div className="space-y-2">
        {sorted.slice(0, 5).map((risk) => {
          const config = getRiskSeverityConfig(risk.severity);
          const project = projects?.find((p) => p.id === risk.projectId);
          return (
            <div key={risk.id} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm text-slate-700 truncate flex-1">{risk.title}</span>
              {project && (
                <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getProjectColor(risk.projectId) }} />
                  {project.code}
                </span>
              )}
              <Badge variant="default" className={config.bgClass + ' ' + config.textClass + ' shrink-0'}>
                {config.label}
              </Badge>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-4">暂无风险记录</div>
        )}
      </div>
    </Card>
  );
}
