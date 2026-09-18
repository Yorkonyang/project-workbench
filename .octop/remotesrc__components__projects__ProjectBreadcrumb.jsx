import { Link } from 'react-router-dom';
import { getAncestors } from '@/lib/hierarchy';

/**
 * 项目层级面包屑（前端）
 * 展示：根 → ... → 直属父 → 当前项目 的层级链。
 *
 * props:
 *  - projectId: 当前任务/里程碑/文档所属项目 id
 *  - projects: 全量项目数组（用于上溯祖先）
 *  - includeSelf: 是否包含自身（默认 true）
 *  - asLink: 是否可点击跳转（默认 true）
 *  - className: 附加样式
 */
export default function ProjectBreadcrumb({ projectId, projects, includeSelf = true, asLink = true, className = '' }) {
  const project = (projects || []).find((p) => p.id === projectId);
  if (!project) return null;

  // getAncestors 返回 根 → ... → 直属父
  const ancestors = getAncestors(projects, projectId);
  const items = includeSelf ? [...ancestors, project] : ancestors;
  if (items.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-slate-400 flex-wrap ${className}`}>
      {items.map((p, i) => (
        <span key={p.id} className="inline-flex items-center gap-1 max-w-[180px]">
          {i > 0 && <span className="text-slate-300">/</span>}
          {asLink ? (
            <Link to={`/projects/${p.id}`} title={`${p.code} ${p.name}`} className="hover:text-primary-600 truncate">
              {p.name}
            </Link>
          ) : (
            <span title={`${p.code} ${p.name}`} className="truncate">{p.name}</span>
          )}
        </span>
      ))}
    </span>
  );
}
