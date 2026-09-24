import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, Pencil, Trash2, BookOpen, Layers, Check, X, ArrowLeft } from 'lucide-react';
import { useDictionaryStore } from '@/store/useDictionaryStore';
import { cn } from '@/lib/utils';

// ==================== 项目类型表单弹窗 ====================
function ProjectTypeForm({ type, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: type?.name || '',
    description: type?.description || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请输入项目类型名称');
      return;
    }
    onSave({ ...type, ...formData });
  };

  return (
    <Modal title={type ? '编辑项目类型' : '新增项目类型'} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            类型名称 <span className="text-red-500">*</span>
          </label>
          <Input
            name="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="如：软件开发、硬件研发、基础设施建设"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">描述</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth resize-none"
            placeholder="简要说明该类型的适用范围..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" /> 取消
          </Button>
          <Button type="submit" variant="primary">
            <Check className="w-4 h-4" /> 保存
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ==================== 项目阶段表单弹窗（必须先选项目类型） ====================
function ProjectStageForm({ stage, projectTypes, presetTypeId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: stage?.name || '',
    // 新增时自动关联筛选下拉框已选的项目类型；编辑时保留原类型
    projectTypeId: stage?.projectTypeId || presetTypeId || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请输入阶段名称');
      return;
    }
    if (!formData.projectTypeId) {
      alert('请先选择所属项目类型');
      return;
    }
    onSave({ ...stage, ...formData });
  };

  return (
    <Modal title={stage ? '编辑项目阶段' : '新增项目阶段'} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            所属项目类型 <span className="text-red-500">*</span>
          </label>
          <select
            name="projectTypeId"
            value={formData.projectTypeId}
            onChange={(e) => setFormData((prev) => ({ ...prev, projectTypeId: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth bg-white"
          >
            <option value="">请选择项目类型</option>
            {projectTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">阶段与项目类型级联关联，选择类型后该阶段仅对该类型项目生效</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            阶段名称 <span className="text-red-500">*</span>
          </label>
          <Input
            name="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="如：需求调研、方案设计、量产验证"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" /> 取消
          </Button>
          <Button type="submit" variant="primary">
            <Check className="w-4 h-4" /> 保存
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ==================== 主页面 ====================
export default function DictionaryPage() {
  const {
    projectTypes,
    projectStages,
    loading,
    fetchProjectTypes,
    fetchProjectStages,
    addProjectType,
    updateProjectType,
    deleteProjectType,
    addProjectStage,
    updateProjectStage,
    deleteProjectStage,
  } = useDictionaryStore();

  // Tab: 'types' | 'stages'
  const [activeTab, setActiveTab] = useState('types');
  // 项目阶段页：当前选中的项目类型过滤
  const [filterTypeId, setFilterTypeId] = useState('');
  // 弹窗状态
  const [typeModal, setTypeModal] = useState(null);   // null | {type} 或 {type:null} 表示新增
  const [stageModal, setStageModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // {kind:'type'|'stage', id, name}

  useEffect(() => {
    fetchProjectTypes().catch(() => {});
    fetchProjectStages().catch(() => {});
  }, [fetchProjectTypes, fetchProjectStages]);

  // 默认选中第一个类型作为过滤
  useEffect(() => {
    if (activeTab === 'stages' && !filterTypeId && projectTypes.length > 0) {
      setFilterTypeId(projectTypes[0]?.id || '');
    }
  }, [activeTab, projectTypes, filterTypeId]);

  const filteredStages = filterTypeId
    ? projectStages.filter((s) => s.projectTypeId === filterTypeId)
    : projectStages;

  // 列表按数组顺序显示（新记录追加在末尾）
  const sortedTypes = [...projectTypes];
  const sortedStages = [...filteredStages];

  const handleSaveType = async (data) => {
    try {
      if (data.id) {
        await updateProjectType(data.id, data);
      } else {
        await addProjectType(data);
      }
      setTypeModal(null);
    } catch (err) {
      alert('保存失败: ' + err.message);
    }
  };

  const handleSaveStage = async (data) => {
    try {
      if (data.id) {
        await updateProjectStage(data.id, data);
      } else {
        const stage = await addProjectStage(data);
        // 新建成功后，将筛选切换到该阶段所属的项目类型，确保新阶段立即可见
        if (stage?.projectTypeId) {
          setFilterTypeId(stage.projectTypeId);
        }
      }
      setStageModal(null);
    } catch (err) {
      alert('保存失败: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'type') {
        await deleteProjectType(deleteTarget.id);
      } else {
        await deleteProjectStage(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (err) {
      alert('删除失败: ' + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">数据字典</h1>
          <p className="text-sm text-slate-500 mt-1">维护项目类型与项目阶段字典，项目阶段按项目类型级联管理</p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab('types')}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-smooth',
            activeTab === 'types' ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <BookOpen className="w-4 h-4" /> 项目类型
          <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full', activeTab === 'types' ? 'bg-white/20' : 'bg-slate-100')}>
            {projectTypes.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('stages')}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-smooth',
            activeTab === 'stages' ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <Layers className="w-4 h-4" /> 项目阶段
          <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full', activeTab === 'stages' ? 'bg-white/20' : 'bg-slate-100')}>
            {projectStages.length}
          </span>
        </button>
      </div>

      {/* ========== 项目类型 Tab ========== */}
      {activeTab === 'types' && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">项目类型列表</h2>
            <Button variant="primary" size="sm" onClick={() => setTypeModal({ type: null })}>
              <Plus className="w-4 h-4" /> 新增类型
            </Button>
          </div>

          {loading && sortedTypes.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">加载中...</div>
          ) : sortedTypes.length === 0 ? (
            <div className="py-16">
              <EmptyState
                icon={BookOpen}
                title="暂无项目类型"
                description="点击右上角「新增类型」创建第一个项目类型"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-3 font-medium">类型名称</th>
                    <th className="px-6 py-3 font-medium">描述</th>
                    <th className="px-6 py-3 font-medium">阶段数</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTypes.map((t) => {
                    const stageCount = projectStages.filter((s) => s.projectTypeId === t.id).length;
                    return (
                      <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-smooth">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-primary-500" />
                            <span className="font-medium text-slate-700">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-500">{t.description || '-'}</td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 text-xs font-medium">
                            <Layers className="w-3 h-3" /> {stageCount} 个阶段
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setTypeModal({ type: t })}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary-600 transition-smooth"
                              title="编辑"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ kind: 'type', id: t.id, name: t.name })}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-500 transition-smooth"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ========== 项目阶段 Tab ========== */}
      {activeTab === 'stages' && (
        <Card className="p-0 overflow-hidden">
          {/* 级联选择器 */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3 flex-1">
              <label className="text-sm font-medium text-slate-600 whitespace-nowrap">项目类型筛选</label>
              <select
                value={filterTypeId}
                onChange={(e) => setFilterTypeId(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth bg-white"
              >
                <option value="">全部类型</option>
                {sortedTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {filterTypeId && (
                <span className="text-sm text-slate-400 inline-flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                  当前显示「{sortedTypes.find((t) => t.id === filterTypeId)?.name || ''}」的阶段
                </span>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={() => setStageModal({ stage: null, presetTypeId: filterTypeId })}>
              <Plus className="w-4 h-4" /> 新增阶段
            </Button>
          </div>

          {loading && projectStages.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">加载中...</div>
          ) : sortedStages.length === 0 ? (
            <div className="py-16">
              <EmptyState
                icon={Layers}
                title="没有匹配的项目阶段"
                description="点击右上角「新增阶段」，选择项目类型后创建阶段"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-3 font-medium">阶段名称</th>
                    <th className="px-6 py-3 font-medium">所属项目类型</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStages.map((s) => {
                    const typeName = projectTypes.find((t) => t.id === s.projectTypeId)?.name || '未知类型';
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-smooth">
                        <td className="px-6 py-3">
                          <span className="font-medium text-slate-700">{s.name}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                            {typeName}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setStageModal({ stage: s })}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary-600 transition-smooth"
                              title="编辑"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ kind: 'stage', id: s.id, name: s.name })}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-500 transition-smooth"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 弹窗 */}
      {typeModal && (
        <ProjectTypeForm
          type={typeModal.type}
          onClose={() => setTypeModal(null)}
          onSave={handleSaveType}
        />
      )}
      {stageModal && (
        <ProjectStageForm
          stage={stageModal.stage}
          projectTypes={sortedTypes}
          presetTypeId={stageModal.presetTypeId}
          onClose={() => setStageModal(null)}
          onSave={handleSaveStage}
        />
      )}

      {/* 删除确认 */}
      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.kind === 'type' ? '删除项目类型' : '删除项目阶段'}
          message={
            deleteTarget.kind === 'type'
              ? `确定删除项目类型「${deleteTarget.name}」吗？其下所有阶段将一并删除，历史项目不受影响。`
              : `确定删除项目阶段「${deleteTarget.name}」吗？`
          }
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          danger
        />
      )}
    </div>
  );
}