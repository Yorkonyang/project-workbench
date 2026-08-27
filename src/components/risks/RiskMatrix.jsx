import Card from '@/components/ui/Card';

const STALLED_CIRCLE_COLORS = { low: '#eab308', medium: '#ef4444', high: '#a855f7' };
const OVERDUE_STAR_COLORS = { medium: '#eab308', high: '#ef4444', critical: '#a855f7' };

function getRiskIconsHTML(risk) {
  const st = risk.sourceType;
  const combined = st === 'task_stalled' || st === 'todo_stalled' || risk.description?.includes('且停滞');
  const hasOverdue = !st || st === 'task' || st === 'todo' || combined;
  const hasStalled = st === 'task_stalled' || st === 'todo_stalled' || combined;

  if (!hasOverdue && !hasStalled) return '';

  const sev = risk.severity;
  let circleColor = STALLED_CIRCLE_COLORS[sev] || STALLED_CIRCLE_COLORS.medium;
  let starColor = OVERDUE_STAR_COLORS[sev] || OVERDUE_STAR_COLORS.high;

  // 单独停滞：用 low 级颜色
  if (hasStalled && !hasOverdue) {
    circleColor = STALLED_CIRCLE_COLORS.low;
  }
  // 仅逾期：按 severity 映射
  if (hasOverdue && !hasStalled) {
    const map = { medium: OVERDUE_STAR_COLORS.medium, high: OVERDUE_STAR_COLORS.high, critical: OVERDUE_STAR_COLORS.critical };
    starColor = map[sev] || OVERDUE_STAR_COLORS.high;
  }
  // 合并：均用实际 severity 颜色
  if (hasOverdue && hasStalled) {
    circleColor = STALLED_CIRCLE_COLORS[sev] || STALLED_CIRCLE_COLORS.medium;
    starColor = OVERDUE_STAR_COLORS[sev] || OVERDUE_STAR_COLORS.high;
  }

  if (hasOverdue && hasStalled) {
    return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:12px;line-height:1"><span style="color:${starColor}">★</span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${circleColor}"></span></span>`;
  }
  if (hasOverdue) {
    return `<span style="color:${starColor};font-size:12px;line-height:1">★</span>`;
  }
  return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${circleColor};vertical-align:middle;margin-right:3px"></span>`;
}

function extractTitle(text) {
  if (!text) return '';
  const m = text.match(/「(.+?)」/);
  if (m) return m[1];
  return text.substring(0, 22);
}

export default function RiskMatrix({ risks, projects, onOpenRisk }) {
  const cells = {
    'high-high': [], 'high-medium': [], 'high-low': [],
    'medium-high': [], 'medium-medium': [], 'medium-low': [],
    'low-high': [], 'low-medium': [], 'low-low': [],
  };

  risks.forEach((r) => {
    const key = `${r.probability}-${r.severity === 'critical' ? 'high' : r.severity === 'low' ? 'low' : 'medium'}`;
    if (cells[key]) cells[key].push(r);
  });

  const cellColor = (prob, sev) => {
    const score = { high: 3, medium: 2, low: 1 };
    const total = (score[prob] || 0) * (score[sev] || 0);
    if (total >= 6) return '#fef2f2';
    if (total >= 4) return '#fff7ed';
    if (total >= 2) return '#fffbeb';
    return '#f0fdf4';
  };

  const cellBorder = (prob, sev) => {
    const score = { high: 3, medium: 2, low: 1 };
    const total = (score[prob] || 0) * (score[sev] || 0);
    if (total >= 6) return '#fca5a5';
    if (total >= 4) return '#fdba74';
    if (total >= 2) return '#fcd34d';
    return '#86efac';
  };

  return (
    <Card title="风险矩阵（概率 × 影响）">
      <div className="flex">
        <div className="flex flex-col items-center justify-center pr-2">
          <span className="text-xs text-slate-400 transform -rotate-90 whitespace-nowrap font-medium">概率</span>
        </div>

        <div className="flex-1">
          <div className="grid grid-cols-3 gap-1.5">
            {['high', 'medium', 'low'].map((prob) =>
              ['high', 'medium', 'low'].map((sev) => {
                const cellRisks = cells[`${prob}-${sev}`] || [];
                return (
                  <div
                    key={`${prob}-${sev}`}
                    className="relative rounded-lg p-2 min-h-[72px] border-2"
                    style={{ backgroundColor: cellColor(prob, sev), borderColor: cellBorder(prob, sev) }}
                  >
                    {cellRisks.length > 0 ? (
                      <div className="space-y-1">
                        {cellRisks.map((r) => (
                          <div
                            key={r.id}
                            className="text-xs bg-white/80 rounded px-1.5 py-1 truncate cursor-pointer hover:bg-white transition-colors"
                            title={r.title}
                            onClick={() => onOpenRisk?.(r)}
                          >
                            <span
                              className="mr-1 inline"
                              dangerouslySetInnerHTML={{ __html: getRiskIconsHTML(r) }}
                            />
                            <span className="font-medium text-slate-700">{extractTitle(r.title)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 text-center pt-4">-</div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="text-center text-xs text-slate-400 font-medium mt-1.5">影响程度</div>

          <div className="flex justify-between px-2 mt-0.5">
            <span className="text-[10px] text-slate-400">低</span>
            <span className="text-[10px] text-slate-400">中</span>
            <span className="text-[10px] text-slate-400">高</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-8 mt-1 text-[10px] text-slate-400">
        <span>低 ↑</span>
        <span>中 ↑</span>
        <span>高 ↑</span>
      </div>
    </Card>
  );
}
