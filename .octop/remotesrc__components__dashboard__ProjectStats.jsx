import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import { FolderKanban, ArrowRight } from 'lucide-react';

export default function ProjectStats({ projects, includeSubprojects = false }) {
  const navigate = useNavigate();
  const activeProjects = projects.filter((p) => !p.archived);
  const inProgress = activeProjects.filter((p) => p.status === 'in_progress').length;

  return (
    <Card
      title="项目管理"
      action={
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          查看全部 <ArrowRight className="w-3 h-3" />
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{activeProjects.length}</div>
              <div className="text-xs text-slate-500">
                {includeSubprojects ? '根项目（含子项目）' : '进行中项目'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-primary-600">{inProgress}</div>
            <div className="text-xs text-slate-500">当前进行</div>
          </div>
        </div>

        {activeProjects.length > 0 && (
          <div className="space-y-2">
            {activeProjects.slice(0, 3).map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm text-slate-700 truncate flex-1">{p.name}</span>
                {includeSubprojects && p._subtreeChildCount > 0 && (
                  <span className="text-[10px] text-primary-500 bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
                    +{p._subtreeChildCount} 子
                  </span>
                )}
                <span className="text-xs text-slate-400">{p.phase}</span>
              </div>
            ))}
            {activeProjects.length > 3 && (
              <div className="text-xs text-slate-400 text-center pt-1">
                +{activeProjects.length - 3} 个更多项目
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
