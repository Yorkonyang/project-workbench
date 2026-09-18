import { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { getRiskSeverityConfig, getProjectColor, formatDate, cn } from '@/lib/utils';

const STATUS_CONFIG = {
  open: { label: '待处理', variant: 'danger' },
  mitigating: { label: '处理中', variant: 'warning' },
  closed: { label: '已关闭', variant: 'success' },
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// 停滞风险：圆形，severity → 颜色（low=黄色，medium=红色，high=紫色）
const STALLED_CIRCLE_COLORS = { low: '#eab308', medium: '#ef4444', high: '#a855f7' };

// 逾期风险：五角星，severity → 颜色（medium=黄色，high=红色，critical=紫色）
const OVERDUE_STAR_COLORS = { medium: '#eab308', high: '#ef4444', critical: '#a855f7' };

function getStalledSeverity(risk) {
  const sev = risk.severity;
  if (sev === 'high') return 'high';
  if (sev === 'medium') return 'medium';
  return 'low';
}

function getOverdueSeverity(risk) {
  const sev = risk.severity;
  if (sev === 'critical') return 'critical';
  if (sev === 'high') return 'high';
  return 'medium';
}

// 判断是否是合并状态（同时逾期+停滞）
function isCombined(risk) {
  const st = risk.sourceType;
  // 来源类型明确标识合并状态
  if (st === 'task_stalled' || st === 'todo_stalled') return true;
  // 描述中包含双指标
  if (risk.description?.includes('且停滞')) return true;
  return false;
}

const RiskIcons = ({ risk }) => {
  const st = risk.sourceType;
  const combined = isCombined(risk);

  // 逾期：无 sourceType / task / todo / 或合并状态
  const hasOverdue = !st || st === 'task' || st === 'todo' || combined;
  // 停滞：task_stalled / todo_stalled / 或合并状态
  const hasStalled = st === 'task_stalled' || st === 'todo_stalled' || combined;

  if (!hasOverdue && !hasStalled) return null;

  const stalledSev = getStalledSeverity(risk);
  const overdueSev = getOverdueSeverity(risk);

  const circleColor = STALLED_CIRCLE_COLORS[stalledSev] || STALLED_CIRCLE_COLORS.medium;
  const starColor = OVERDUE_STAR_COLORS[overdueSev] || OVERDUE_STAR_COLORS.high;

  const star = <span title="逾期风险" style={{ color: starColor, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>★</span>;
  const circle = (
    <span
      title="进展停滞风险"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: circleColor,
        flexShrink: 0,
      }}
    />
  );

  // 两者都有：左星右圆，水平对齐
  if (hasOverdue && hasStalled) {
    return (
      <span
        title="逾期且进展停滞"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, lineHeight: 1, flexShrink: 0 }}
      >
        {star}
        {circle}
      </span>
    );
  }
  if (hasOverdue) return star;
  return circle;
};

export default function RiskList({ risks, projects, onEdit, onDelete, onOpen }) {
  // 用 ref 记录高严重度未关闭风险的 id，避免每次 risks 变化都重算
  const riskIdsRef = useRef(new Set());
  const [flashingSet, setFlashingSet] = useState(new Set());

  // 仅在 risks 变化时更新 ref（不触发额外的 useEffect 重跑）
  useEffect(() => {
    const ids = new Set();
    risks.forEach((r) => {
      if ((r.severity === 'high' || r.severity === 'critical') && r.status !== 'closed') {
        ids.add(r.id);
      }
    });
    riskIdsRef.current = ids;
  }, [risks]);

  // 独立的闪烁循环：每 3 秒闪烁一次，不影响其他逻辑
  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      // 清除闪烁
      setFlashingSet(new Set());
      // 400ms 后恢复
      const t = setTimeout(() => {
        if (!cancelled) setFlashingSet(new Set(riskIdsRef.current));
      }, 400);

      // 注册清理定时器
      const cleanup = () => clearTimeout(t);
      // 将 cleanup 存到模块级以便清除
      tick._cleanup = cleanup;
    };

    tick();
    const interval = setInterval(tick, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (tick._cleanup) tick._cleanup();
    };
  }, []); // 只跑一次，引用外部 ref

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
        const isFlashing = flashingSet.has(risk.id);

        return (
          <div
            key={risk.id}
            id={`risk-card-${risk.id}`}
            className={cn(
              'bg-white rounded-lg border border-slate-200 p-3 transition-all duration-300',
              onOpen && 'cursor-pointer hover:shadow-md'
            )}
            onClick={() => onOpen?.(risk)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <RiskIcons risk={risk} />
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

              <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
