import { useState, useRef, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useDictionaryStore } from '@/store/useDictionaryStore';
import { Paperclip, X, Download, Plus } from 'lucide-react';

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileExtension(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  const extMap = {
    pdf: 'PDF', doc: 'WORD', docx: 'WORD', xls: 'EXCEL', xlsx: 'EXCEL',
    ppt: 'PPT', pptx: 'PPT', txt: '文本',
    jpg: '图片', jpeg: '图片', png: '图片', gif: '图片', svg: '图片',
    zip: '压缩包', rar: '压缩包', '7z': '压缩包',
  };
  return extMap[ext] || (ext ? ext.toUpperCase() : '文件');
}

export default function DocumentForm({ onClose, document = null, projects, defaultProjectId = '', defaultCategory = '' }) {
  const addDocument = useDocumentStore((s) => s.addDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const addFile = useDocumentStore((s) => s.addFile);
  const removeFile = useDocumentStore((s) => s.removeFile);
  const newFileInputRef = useRef(null);

  // 数据字典：项目类型 + 项目阶段（用于级联查询）
  const projectTypes = useDictionaryStore((s) => s.projectTypes);
  const projectStages = useDictionaryStore((s) => s.projectStages);

  // 校验传入的默认项目是否存在且未归档，否则回退到第一个可用项目
  const safeDefaultProjectId =
    defaultProjectId && projects.some((p) => p.id === defaultProjectId && !p.archived)
      ? defaultProjectId
      : '';

  const [form, setForm] = useState({
    projectId:
      document?.projectId ||
      safeDefaultProjectId ||
      projects.filter((p) => !p.archived)[0]?.id ||
      '',
    title: document?.title || '',
    category: document?.category || defaultCategory || '',
    description: document?.description || '',
    tags: document?.tags ? (Array.isArray(document.tags) ? document.tags.join(', ') : document.tags) : '',
  });
  // 附件列表：每次打开编辑时从 document.files 初始化，新增的文件追加到列表中
  const [files, setFiles] = useState(() => (document?.files || []).map((f) => ({ ...f })));

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // ===== 级联查询：所属项目 → 项目类型 → 项目阶段 =====
  const currentProject = projects.find((p) => p.id === form.projectId);
  // 1. 根据所选项目查到项目类型
  const currentType = projectTypes.find((t) => t.id === currentProject?.projectTypeId || t.id === currentProject?.project_type_id);
  // 2. 根据项目类型查出该项目类型的项目阶段（分类候选）
  const stageOptions = useMemo(() => {
    if (!currentType) return [];
    return projectStages
      .filter((s) => s.projectTypeId === currentType.id)
      .map((s) => ({ value: s.name, label: s.name }));
  }, [currentType, projectStages]);

  // 状态 → 阶段名 映射（用于「正确引用」项目当前阶段：项目进行中则引用「进行中」阶段）
  const STATUS_LABEL = { planned: '待启动', in_progress: '进行中', paused: '暂停', completed: '已完成' };
  // 解析文档应引用的阶段：优先项目自身 phase；其次与项目状态同名的阶段；最后该类型第一阶段
  const resolveStageName = (proj) => {
    if (!proj) return null;
    if (proj.phase) return proj.phase;
    const ptype = projectTypes.find((t) => t.id === proj.projectTypeId || t.id === proj.project_type_id);
    if (!ptype) return null;
    const typeStages = projectStages.filter((s) => s.projectTypeId === ptype.id);
    if (proj.status && typeStages.some((s) => s.name === STATUS_LABEL[proj.status])) {
      return STATUS_LABEL[proj.status];
    }
    return typeStages[0]?.name || null;
  };

  // 若未指定分类，正确引用所属项目的实际阶段（避免一律引用类型第一阶段「待启动」）
  useEffect(() => {
    if (form.category) return;
    const proj = projects.find((p) => p.id === form.projectId);
    const stageName = resolveStageName(proj);
    if (stageName) setForm((f) => ({ ...f, category: stageName }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.projectId, projects, projectTypes, projectStages]);

  // 切换项目时：若原阶段不属于新项目类型，则按正确引用规则重新带出阶段
  const handleProjectChange = (projectId) => {
    const nextProject = projects.find((p) => p.id === projectId);
    const nextType = projectTypes.find((t) => t.id === nextProject?.projectTypeId || t.id === nextProject?.project_type_id);
    const nextStages = nextType
      ? projectStages.filter((s) => s.projectTypeId === nextType.id)
      : [];
    const keepCurrent = nextStages.some((s) => s.name === f.category);
    const nextCategory = keepCurrent ? f.category : resolveStageName(nextProject) || '';
    setForm((f) => ({
      ...f,
      projectId,
      category: nextCategory,
    }));
  };

  // 编辑已有文档：若项目类型阶段未包含原分类，自动补回原值到选项（保持兼容旧数据）
  const effectiveStageOptions = useMemo(() => {
    if (form.category && !stageOptions.some((o) => o.value === form.category)) {
      return [{ value: form.category, label: form.category }, ...stageOptions];
    }
    return stageOptions;
  }, [form.category, stageOptions]);

  const handleAddFile = (e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    Array.from(fileList).forEach((file) => {
      const url = URL.createObjectURL(file);
      const newFile = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        name: file.name,
        size: formatFileSize(file.size),
        type: getFileExtension(file.name),
      };
      setFiles((prev) => [...prev, newFile]);
    });
    if (newFileInputRef.current) newFileInputRef.current.value = '';
  };

  const handleRemoveFile = (fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleDownloadFile = (file) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.click();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const now = new Date().toISOString();
    if (document) {
      // 编辑模式：更新基本信息 + 附件列表
      updateDocument(document.id, {
        ...form,
        files,
        updatedAt: now,
      });
    } else {
      // 新建模式
      addDocument({
        ...form,
        files,
        createdAt: now,
        updatedAt: now,
      });
    }
    onClose();
  };

  return (
    <Modal title={document ? '编辑文档' : '添加文档'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="文档标题"
          value={form.title}
          onChange={(e) => set('title')(e.target.value)}
          placeholder="请输入文档标题"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="所属项目"
            value={form.projectId}
            onChange={handleProjectChange}
            options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            label="项目阶段"
            value={form.category}
            onChange={set('category')}
            options={effectiveStageOptions}
            placeholder={currentType ? (stageOptions.length === 0 ? '该项目类型暂无阶段，请先维护数据字典' : '请选择项目阶段') : '请先选择所属项目'}
            disabled={!currentType || stageOptions.length === 0}
          />
        </div>

        {/* 级联说明 */}
        <p className="text-xs text-slate-400 -mt-1">
          {currentType
            ? `已根据「${currentProject?.name}」查询到项目类型「${currentType.name}」，项目阶段自动级联为该类型的阶段`
            : '选择所属项目后，将根据项目类型自动匹配可用的项目阶段'}
        </p>

        {/* 附件上传区 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">附件</label>

          {/* 附件列表 */}
          {files.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{file.size}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(file)}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-500 transition-colors"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                    className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"
                    title="删除此附件"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 上传按钮 */}
          <button
            type="button"
            onClick={() => newFileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-primary-400 hover:text-primary-500 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>上传附件</span>
          </button>
          <input
            ref={newFileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar"
            className="hidden"
            multiple
            onChange={handleAddFile}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth"
            placeholder="请输入文档描述（可选）"
          />
        </div>

        <Input
          label="标签（逗号分隔）"
          value={form.tags}
          onChange={(e) => set('tags')(e.target.value)}
          placeholder="MOM, 需求, 重要"
        />

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            取消
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={!form.title.trim()}>
            {document ? '保存修改' : '添加文档'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
