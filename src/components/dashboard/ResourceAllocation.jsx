import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import { getProjectColor } from '@/lib/utils';

export default function ResourceAllocation({ resources, projects }) {
  const projectGroups = projects.map((p) => ({
    project: p,
    resources: resources.filter((r) => r.projectId === p.id),
  }));

  return (
    <Card title="资源分配">
      <div className="space-y-4">
        {projectGroups.map(({ project, resources: projRes }) => (
          <div key={project.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.color }} />
              <span className="text-sm font-medium text-slate-700">{project.name}</span>
              <span className="text-xs text-slate-400">({projRes.length} 个资源)</span>
            </div>
            <div className="space-y-1.5 pl-4">
              {projRes.map((res) => (
                <div key={res.id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-24 truncate">{res.name}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={res.allocation}
                      color={project.color}
                      height="h-1.5"
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-8 text-right">{res.allocation}%</span>
                </div>
              ))}
              {projRes.length === 0 && (
                <div className="text-xs text-slate-300 py-1">暂无资源</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
