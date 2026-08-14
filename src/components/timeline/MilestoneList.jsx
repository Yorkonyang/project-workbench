import { Flag, Edit2, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { getMilestoneStatusConfig, formatDate, getProjectColor } from '@/lib/utils';

export default function MilestoneList({ milestones, projects, onEdit, onDelete }) {
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card title="里程碑列表">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 px-3 font-medium">里程碑</th>
              <th className="py-2 px-3 font-medium">项目</th>
              <th className="py-2 px-3 font-medium">日期</th>
              <th className="py-2 px-3 font-medium">状态</th>
              <th className="py-2 px-3 font-medium hidden md:table-cell">交付物</th>
              <th className="py-2 px-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ms) => {
              const config = getMilestoneStatusConfig(ms.status);
              const project = projects?.find((p) => p.id === ms.projectId);
              return (
                <tr key={ms.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" style={{ color: config.color }} />
                      <span className="font-medium text-slate-800">{ms.title}</span>
                      {ms.isCritical && <Badge variant="danger" className="text-xs">关键</Badge>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    {project && (
                      <span className="flex items-center gap-1 text-xs text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                        {project.code}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{formatDate(ms.date)}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant="default" className={config.bgClass + ' ' + config.textClass}>
                      {config.label}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 hidden md:table-cell text-xs text-slate-400 max-w-xs truncate">
                    {ms.deliverables || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onEdit?.(ms)}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete?.(ms)}
                        className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
