import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useDocumentStore } from '@/store/useDocumentStore';
import { Paperclip, X, Download, Plus } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: '需求文档', label: '需求文档' },
  { value: '设计文档', label: '设计文档' },
  { value: '测试报告', label: '测试报告' },
  { value: '部署文档', label: '部署文档' },
  { value: '培训资料', label: '培训资料' },
  { value: '验收报告', label: '验收报告' },
  { value: '计划报告', label: '计划报告' },
  { value: '会议纪要', label: '会议纪要' },
  { value: '其他', label: '其他' },
];

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

export default function DocumentForm({ onClose, document = null, projects }) {
  const addDocument = useDocumentStore((s) => s.addDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const addFile = useDocumentStore((s) => s.addFile);
  const removeFile = useDocumentStore((s) => s.removeFile);
  const newFileInputRef = useRef(null);

  const defaultCategory = '其他';

  const [form, setForm] = useState({
    projectId: document?.projectId || projects.filter((p) => !p.archived)[0]?.id || '',
    title: document?.title || '',
    category: document?.category || defaultCategory,
    description: document?.description || '',
    tags: document?.tags ? (Array.isArray(document.tags) ? document.tags.join(', ') : document.tags) : '',
  });
  // 附件列表：每次打开编辑时从 document.files 初始化，新增的文件追加到列表中
  const [files, setFiles] = useState(() => (document?.files || []).map((f) => ({ ...f })));

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

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
            onChange={set('projectId')}
            options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            label="分类"
            value={form.category}
            onChange={set('category')}
            options={CATEGORY_OPTIONS}
          />
        </div>

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
