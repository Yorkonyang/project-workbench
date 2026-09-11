/**
 * 项目合并弹窗（P0-5）
 * - 目标选择器：树形列出 getMergeCandidates（排除自身/子孙/已归档/已合并）
 * - 选目标后调用 previewMerge 展示影响预览（MergePreview）
 * - 策略单选：keep（保留层级）/ flatten（拍平）
 * - 冲突高危警告 → 二次强确认 → 调 mergeProject → 成功后跳转目标详情
 */
import { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { AlertTriangle, GitMerge, Search } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { getChildren, getProjectLevel, MAX_DEPTH } from '@/lib/hierarchy';
import MergePreview from '@/components/projects/MergePreview';

export default function MergeDialog({ sourceProject, onClose, onMerge }) {
  const projects = useProjectStore((s) => s.projects);
  const getMergeCandidates = useProjectStore((s) => s.getMergeCandidates);
  const previewMerge = useProjectStore((s) => s.previewMerge);

  const candidates = useMemo(
    () => (sourceProject ? getMergeCandidates(sourceProject.id) : []),
    [getMergeCandidates, sourceProject, projects]
  );

  const [targetId, setTargetId] = useState('');
  const [strategy, setStrategy] = useState('keep');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [merging, setMerging] = useState(false);

  // 树形递归渲染候选目标（缩进 + 层级徽标）
  const renderCandidate = (p, level = 0) => {
    const children = getChildren(projects, p.id).filter((c) =>
      candidates.some((cc) => cc.id === c.id)
    );
    return (
      <div key={p.id}>
        <button
          type="button"
          onClick={() => {
            setTargetId(p.id);
            setPreview(null);
            setConfirmed(false);
            setError('');
          }}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-smooth',
            targetId === p.id ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'hover:bg-slate-50'
          )}
          style={{ paddingLeft: 8 + level * 16 }}
        >
          <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">L{level}</span>
          <span className="font-mono text-xs text-slate-400 shrink-0">{p.code}</span>
          <span className="truncate flex-1">{p.name}</span>
        </button>
        {children.map((c) => renderCandidate(c, level + 1))}
      </div>
    );
  };

  const handlePreview = async () => {
    if (!targetId) return;
    setLoading(true);
    setError('');
    try {
      const data = await previewMerge(sourceProject.id, targetId);
      setPreview(data);
    } catch (err) {
      setError(err.message || '预览失败');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!targetId || !preview || preview.wouldCreateCycle) return;
    setMerging(true);
    setError('');
    try {
      await onMerge(sourceProject.id, targetId, strategy);
    } catch (err) {
      setError(err.message || '合并失败');
      setMerging(false);
    }
  };

  const blocked = preview && (preview.wouldCreateCycle || preview.ok === false);
  const warning = preview && (preview.depthExceeded && strategy === 'keep' || preview.codeCollision);

  return (
    <Modal title="合并项目" onClose={onClose} size="xl" scrollable>
      <div className="space-y-4">
        {/* 源项目 */}
        <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">源项目：</span>
          <span className="font-medium text-slate-800">{sourceProject.name}</span>
          <span className="font-mono text-xs text-slate-400">{sourceProject.code}</span>
        </div>

        {/* 目标选择 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">合并到（目标项目）</label>
          <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto p-1.5 bg-white">
            {candidates.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-6">暂无可用目标（已排除自身/子孙/已归档/已合并）</div>
            ) : (
              candidates.filter((p) => !p.parentProjectId).map((p) => renderCandidate(p, 0))
            )}
          </div>
          {targetId && (
            <button
              onClick={handlePreview}
              disabled={loading}
              className="mt-2 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" />
              {loading ? '计算中…' : '预览合并影响'}
            </button>
          )}
        </div>

        {/* 策略 */}
        {preview && !blocked && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">合并策略</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStrategy('keep'); setConfirmed(false); }}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg border text-sm text-left transition-smooth',
                  strategy === 'keep' ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="font-medium">保留层级（keep）</div>
                <div className="text-[11px] text-slate-500">源的子项目改挂到目标下，保留各自层级</div>
              </button>
              <button
                type="button"
                onClick={() => { setStrategy('flatten'); setConfirmed(false); }}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg border text-sm text-left transition-smooth',
                  strategy === 'flatten' ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="font-medium">拍平（flatten）</div>
                <div className="text-[11px] text-slate-500">源整棵子树直接挂到目标，丢弃中间层级</div>
              </button>
            </div>
          </div>
        )}

        {/* 预览 */}
        {preview && !blocked && (
          <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
            <MergePreview preview={preview} strategy={strategy} />
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        {/* 高危二次确认 */}
        {(warning || (preview && !blocked)) && (
          <label className="flex items-start gap-2 text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              <AlertTriangle className="w-3.5 h-3.5 inline text-amber-500 mr-1" />
              我已了解合并后源项目将被隐藏（仅强确认，不可撤销），且相关数据归属目标。确认执行合并？
            </span>
          </label>
        )}

        {/* 操作 */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} disabled={merging}>
            取消
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!targetId || !preview || blocked || !confirmed || merging}
            onClick={handleMerge}
            className="bg-red-600 hover:bg-red-700"
          >
            {merging ? '合并中…' : '确认合并'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function cn(...args) {
  return args.filter(Boolean).join(' ');
}
