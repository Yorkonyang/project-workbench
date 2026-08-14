import Card from '@/components/ui/Card';
import { getRiskSeverityConfig, getProjectColor } from '@/lib/utils';

export default function RiskMatrix({ risks, projects }) {
  // 3x3 matrix: probability (high/medium/low) x severity (critical/high/medium/low)
  // Simplify to 3x3: probability (high/medium/low) x impact (high/medium/low)
  const cells = {
    'high-high': [],
    'high-medium': [],
    'high-low': [],
    'medium-high': [],
    'medium-medium': [],
    'medium-low': [],
    'low-high': [],
    'low-medium': [],
    'low-low': [],
  };

  risks.forEach((r) => {
    const key = `${r.probability}-${r.severity === 'critical' ? 'high' : r.severity === 'low' ? 'low' : 'medium'}`;
    if (cells[key]) cells[key].push(r);
  });

  const cellColor = (prob, sev) => {
    const score = { high: 3, medium: 2, low: 1 };
    const total = (score[prob] || 0) * (score[sev] || 0);
    if (total >= 6) return '#fef2f2'; // red bg
    if (total >= 4) return '#fff7ed'; // orange bg
    if (total >= 2) return '#fffbeb'; // amber bg
    return '#f0fdf4'; // green bg
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
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center pr-2">
          <span className="text-xs text-slate-400 transform -rotate-90 whitespace-nowrap font-medium">概率</span>
        </div>

        {/* Matrix grid */}
        <div className="flex-1">
          <div className="grid grid-cols-3 gap-1.5">
            {['high', 'medium', 'low'].map((prob) =>
              ['high', 'medium', 'low'].map((sev) => {
                const cellRisks = cells[`${prob}-${sev}`] || [];
                return (
                  <div
                    key={`${prob}-${sev}`}
                    className="relative rounded-lg p-2 min-h-[72px] border-2"
                    style={{
                      backgroundColor: cellColor(prob, sev),
                      borderColor: cellBorder(prob, sev),
                    }}
                  >
                    {cellRisks.length > 0 ? (
                      <div className="space-y-1">
                        {cellRisks.map((r) => (
                          <div
                            key={r.id}
                            className="text-xs bg-white/80 rounded px-1.5 py-1 truncate cursor-pointer"
                            title={r.title}
                          >
                            <span className="font-medium text-slate-700">{r.title}</span>
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

          {/* X-axis label */}
          <div className="text-center text-xs text-slate-400 font-medium mt-1.5">影响程度</div>

          {/* Axis labels */}
          <div className="flex justify-between px-2 mt-0.5">
            <span className="text-[10px] text-slate-400">低</span>
            <span className="text-[10px] text-slate-400">中</span>
            <span className="text-[10px] text-slate-400">高</span>
          </div>
        </div>
      </div>

      {/* Y-axis labels */}
      <div className="flex justify-end gap-8 mt-1 text-[10px] text-slate-400">
        <span>低 ↑</span>
        <span>中 ↑</span>
        <span>高 ↑</span>
      </div>
    </Card>
  );
}
