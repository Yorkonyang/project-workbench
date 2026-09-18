/**
 * 合并影响预览（纯展示组件）
 * 接收 previewMerge 接口返回的数据，展示移动计数、子项目列表与冲突标志。
 */
export default function MergePreview({ preview, strategy = 'keep' }) {
  if (!preview) return null;

  const {
    counts = {},
    childProjects = [],
    wouldCreateCycle = false,
    depthExceeded = false,
    codeCollision = false,
  } = preview;

  const rows = [
    { label: '任务', value: counts.tasks || 0 },
    { label: '待办', value: counts.todos || 0 },
    { label: '文档', value: counts.documents || 0 },
    { label: '里程碑', value: counts.milestones || 0 },
    { label: '风险', value: counts.risks || 0 },
    { label: '资源', value: counts.resources || 0 },
    { label: '直属子项目', value: counts.childProjects || 0 },
  ];

  const hasConflict = wouldCreateCycle || codeCollision;

  return (
    <div className="space-y-3">
      {/* 冲突/高危提示 */}
      {wouldCreateCycle && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠️ 合并会形成层级环（目标为源的子项目），无法合并。
        </div>
      )}
      {codeCollision && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ 编号冲突：源项目编号与目标子树已有编号重复（P0 允许重名，仅作提醒）。
        </div>
      )}
      {depthExceeded && strategy === 'keep' && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ 深度超限：改挂后部分子项目层级将超出最大深度（MAX_DEPTH），这些子项目将被自动拍平到目标下。
        </div>
      )}
      {strategy === 'flatten' && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          已选择「拍平」策略：源的整棵子树将直接挂到目标下，中间层级不再保留。
        </div>
      )}

      {/* 移动计数 */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1.5">将转移的数据量</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {rows.map((r) => (
            <div key={r.label} className="bg-slate-50 rounded-lg px-3 py-2 text-center">
              <div className="text-base font-bold text-slate-800">{r.value}</div>
              <div className="text-[11px] text-slate-400">{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 子项目列表 */}
      {childProjects.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1.5">源下直属子项目（{childProjects.length} 个）</div>
          <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-2">
            {childProjects.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs text-slate-600 px-1.5 py-1">
                <span className="truncate">{c.name}</span>
                <span className="font-mono text-slate-400 shrink-0 ml-2">{c.code || '无编号'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
