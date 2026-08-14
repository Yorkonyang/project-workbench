import { FileText, Edit2, Trash2, Download } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { formatDate, getProjectColor } from '@/lib/utils';

const CATEGORY_VARIANTS = {
  '需求文档': 'primary',
  '设计文档': 'info',
  '会议纪要': 'warning',
  '验收报告': 'success',
  '计划报告': 'purple',
  '测试报告': 'teal',
  '部署文档': 'default',
  '培训资料': 'default',
  '其他': 'default',
};

export default function DocumentGrid({ documents, projects, onEdit, onDelete }) {
  if (documents.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-12">暂无文档</div>;
  }

  const handleDownload = (e, doc, file) => {
    e.stopPropagation();
    if (file.url) {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      a.click();
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {documents.map((doc) => {
        const project = projects?.find((p) => p.id === doc.projectId);
        const files = doc.files || [];
        const hasFile = files.length > 0;
        return (
          <div
            key={doc.id}
            className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-all-smooth"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit?.(doc)}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete?.(doc)}
                  className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <h4 className="text-sm font-medium text-slate-800 mb-1 line-clamp-2">{doc.title}</h4>
            <p className="text-xs text-slate-400 line-clamp-2 mb-2">{doc.description || '暂无描述'}</p>

            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge variant={CATEGORY_VARIANTS[doc.category] || 'default'}>
                {doc.category}
              </Badge>
              {project && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getProjectColor(doc.projectId) }} />
                  {project.code}
                </span>
              )}
            </div>

            {/* 附件列表 */}
            {hasFile && (
              <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between text-xs group">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-600 truncate" title={file.name}>{file.name}</span>
                      {file.size && <span className="text-slate-300 shrink-0">{file.size}</span>}
                    </div>
                    <button
                      onClick={(e) => handleDownload(e, doc, file)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-blue-500 hover:text-blue-600 cursor-pointer transition-opacity shrink-0 ml-1"
                      title="下载"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50 mt-2">
              <span>{formatDate(doc.createdAt)}</span>
              {hasFile && <span>{files.length} 个附件</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
