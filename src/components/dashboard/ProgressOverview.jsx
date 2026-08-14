import { useNavigate } from 'react-router-dom';
import ProgressBar from '@/components/ui/ProgressBar';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { getProjectStatusConfig } from '@/lib/utils';

export default function ProgressOverview({ projects }) {
  const navigate = useNavigate();

  return (
    <Card title="项目进度总览">
      <div className="space-y-4">
        {projects.map((p) => {
          const statusConfig = getProjectStatusConfig(p.status);
          return (
            <div
              key={p.id}
              className="cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-medium text-slate-800 text-sm">{p.name}</span>
                  <Badge variant="default" className={statusConfig.bgClass + ' ' + statusConfig.textClass}>
                    {statusConfig.label}
                  </Badge>
                </div>
                <span className="text-lg font-bold" style={{ color: p.color }}>{p.progress}%</span>
              </div>
              <ProgressBar value={p.progress} color={p.color} />
              <div className="flex items-center justify-between mt-1.5 text-xs text-slate-400">
                <span>{p.phase}</span>
                <span>{p.startDate} ~ {p.endDate}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
