import { Flag, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { getMilestoneStatusConfig, formatDate, getProjectColor } from '@/lib/utils';

const STATUS_ICONS = {
  achieved: { icon: CheckCircle2, color: '#10b981' },
  upcoming: { icon: Flag, color: '#3b82f6' },
  delayed: { icon: AlertCircle, color: '#ef4444' },
  at_risk: { icon: AlertTriangle, color: '#f59e0b' },
};

export default function MilestoneTimeline({ milestones, projects }) {
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card title="关键里程碑">
      <div className="space-y-3">
        {sorted.map((ms) => {
          const config = getMilestoneStatusConfig(ms.status);
          const IconInfo = STATUS_ICONS[ms.status] || STATUS_ICONS.upcoming;
          const Icon = IconInfo.icon;
          const projectColor = getProjectColor(ms.projectId);
          const project = projects?.find((p) => p.id === ms.projectId);

          return (
            <div key={ms.id} className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${IconInfo.color}15` }}
              >
                <Icon className="w-4 h-4" style={{ color: IconInfo.color }} />
              </div>
              <div className="flex-1 min-w-0 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{ms.title}</span>
                  {ms.isCritical && (
                    <Badge variant="danger" className="text-xs">关键</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">{formatDate(ms.date)}</span>
                  {project && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: projectColor }} />
                      {project.code}
                    </span>
                  )}
                  <Badge variant="default" className={config.bgClass + ' ' + config.textClass}>
                    {config.label}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
