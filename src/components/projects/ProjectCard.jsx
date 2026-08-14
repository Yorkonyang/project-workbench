import { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Flag,
  Archive,
  RotateCcw,
  Pencil,
  CheckCircle2,
  XCircle,
  FileText,
  Trash2,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  paused: { label: '暂停', color: 'bg-amber-100 text-amber-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  archived: { label: '已归档', color: 'bg-slate-100 text-slate-500' },
};

const ARCHIVE_STATUS_CONFIG = {
  none: null,
  requested: { label: '待审批', color: 'bg-amber-100 text-amber-700' },
  approved: { label: '已归档', color: 'bg-slate-100 text-slate-500' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-600' },
};

const REASONS = [
  '项目已完成',
  '项目提前终止',
  '负责人调动',
  '预算调整',
  '其他原因',
];

export default function ProjectCard({ project, onEdit, onArchive, onRestore, onDelete, showArchive = true }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showArchiveRequest, setShowArchiveRequest] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveNote, setArchiveNote] = useState('');
  const [showArchiveActions, setShowArchiveActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const approveArchive = useProjectStore((s) => s.approveArchive);
  const rejectArchive = useProjectStore((s) => s.rejectArchive);
  const requestArchive = useProjectStore((s) => s.requestArchive);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const members = useMemberStore((s) => s.members);
  const currentUser = members.find((m) => m.id === currentUserId);
  const manager = members.find((m) => m.id === project.manager);
  const tasks = useTaskStore((s) => s.tasks);

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const doneTasks = projectTasks.filter((t) => t.status === 'done').length;
  const daysUntilEnd = project.endDate
    ? differenceInDays(parseISO(project.endDate), new Date())
    : null;

  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.in_progress;
  const archiveConfig = ARCHIVE_STATUS_CONFIG[project.archiveStatus] || ARCHIVE_STATUS_CONFIG.none;

  const canRequestArchive = project.status !== 'archived'; // 任何非归档状态的项目都可以申请
  const isArchived = project.archived;
  const isRequested = project.archiveStatus === 'requested';
  const isRejected = project.archiveStatus === 'rejected';
  const isAdmin = currentUser?.role === 'admin';

  const handleRestore = () => {
    restoreProject(project.id);
    addNotification({
      type: 'system',
      title: '项目已恢复',
      message: `「${project.name}」已从归档恢复，状态变更为进行中。`,
      relatedId: project.id,
    });
    onRestore?.(project.id);
  };

  const handleSubmitArchive = () => {
    if (!archiveReason) {
      alert('请选择归档原因');
      return;
    }
    requestArchive(project.id, archiveReason, archiveNote);
    setShowArchiveRequest(false);
    setArchiveReason('');
    setArchiveNote('');
    // 添加通知给管理员
    addNotification({
      type: 'archive_requested',
      title: `新项目归档申请`,
      message: `「${project.name}」提交归档申请，等待审批`,
      relatedId: project.id,
    });
  };

  const handleApprove = () => {
    approveArchive(project.id);
    setShowArchiveActions(false);
    // 添加通知
    addNotification({
      type: 'archive_approved',
      title: `项目归档审批通过`,
      message: `「${project.name}」已审批通过归档`,
      relatedId: project.id,
    });
  };

  const handleReject = () => {
    rejectArchive(project.id);
    setShowArchiveActions(false);
    // 添加通知
    addNotification({
      type: 'archive_rejected',
      title: `项目归档申请被驳回`,
      message: `「${project.name}」归档申请已被驳回`,
      relatedId: project.id,
    });
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    // 调用 store 删除（已对接后端级联删除）
    await deleteProject(project.id);
    // 记录通知
    addNotification({
      type: 'project_deleted',
      title: '项目已删除',
      message: `「${project.name}」已被 ${currentUser?.name || '管理员'} 永久删除`,
      relatedId: project.id,
    });
    // 通知父组件
    onDelete?.(project.id);
  };

  return (
    <>
      <div
        className={cn(
          'bg-white rounded-xl border transition-smooth hover:shadow-md group relative',
          project.archived ? 'border-slate-200 opacity-75' : 'border-slate-200'
        )}
      >
        {/* Header */}
        <div className="p-4 flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: `${project.color}15` }}
            >
              <Flag className="w-5 h-5" style={{ color: project.color }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-slate-400">{project.code}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusConfig.color)}>
                  {statusConfig.label}
                </span>
                {archiveConfig && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', archiveConfig.color)}>
                    {archiveConfig.label}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-slate-800 truncate mt-0.5">{project.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{project.description}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit?.(project)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-smooth"
              title="编辑"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            {/* 申请归档按钮（仅进行中项目可点击） */}
            {showArchive && !project.archived && !isRequested && (
              <button
                onClick={() => {
                  if (canRequestArchive) {
                    setShowArchiveRequest(true);
                  }
                }}
                className={cn(
                  'p-1.5 rounded-lg transition-smooth',
                  canRequestArchive
                    ? 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                    : 'hover:bg-slate-100 text-slate-300 cursor-not-allowed'
                )}
                title={canRequestArchive ? '申请归档' : '仅已完成项目可申请归档'}
                disabled={!canRequestArchive}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            )}

            {/* 审批归档按钮（管理员或待审批状态下显示） */}
            {isRequested && !project.archived && (
              <button
                onClick={() => setShowArchiveActions(true)}
                className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 transition-smooth"
                title="审批归档申请"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}

            {/* 已归档 */}
            {isArchived && (
              <button
                onClick={handleRestore}
                className="p-1.5 hover:bg-green-50 rounded-lg text-slate-400 hover:text-green-600 transition-smooth"
                title="恢复项目"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* 删除按钮（仅管理员可见） */}
            {isAdmin && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-smooth"
                title="永久删除项目"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-4 pb-3 flex flex-wrap gap-4 text-xs text-slate-500">
          {project.startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {format(parseISO(project.startDate), 'MM/dd', { locale: zhCN })}
            </span>
          )}
          {project.endDate && (
            <span className={cn('flex items-center gap-1', daysUntilEnd < 0 ? 'text-red-500' : 'text-slate-500')}>
              <Clock className="w-3.5 h-3.5" />
              {daysUntilEnd < 0 ? `逾期 ${Math.abs(daysUntilEnd)} 天` : `剩余 ${daysUntilEnd} 天`}
            </span>
          )}
          {(manager || project.manager) && (
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {manager ? manager.name : project.manager}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500">任务进度</span>
            <span className="font-medium text-slate-700">
              {doneTasks}/{projectTasks.length}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${projectTasks.length ? (doneTasks / projectTasks.length) * 100 : 0}%`,
                backgroundColor: project.color,
              }}
            />
          </div>
        </div>

        {/* 归档原因提示（已完成项目） */}
        {!project.archived && !isRequested && !isRejected && canRequestArchive && (
          <div className="px-4 pb-3">
            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              可提交归档申请
            </span>
          </div>
        )}

        {/* 已驳回提示 */}
        {isRejected && (
          <div className="px-4 pb-3">
            <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              归档申请已被驳回
            </span>
          </div>
        )}
      </div>

      {/* 申请归档弹窗 */}
      {showArchiveRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowArchiveRequest(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-base">申请项目归档</h3>
              <button
                onClick={() => setShowArchiveRequest(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-smooth"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  归档原因 <span className="text-red-500">*</span>
                </label>
                <select
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                >
                  <option value="">请选择归档原因</option>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">补充说明（可选）</label>
                <textarea
                  value={archiveNote}
                  onChange={(e) => setArchiveNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 resize-none"
                  placeholder="如有其他需要说明的情况..."
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <p>提交后将等待管理员审批，审批通过后方可归档。</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowArchiveRequest(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-smooth"
              >
                取消
              </button>
              <button
                onClick={handleSubmitArchive}
                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-smooth"
              >
                提交审批
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 审批操作弹窗（仅管理员可见） */}
      {showArchiveActions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowArchiveActions(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-base">审批归档申请</h3>
              <button
                onClick={() => setShowArchiveActions(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-smooth"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">项目编号：</span>
                  <span className="font-mono text-slate-800">{project.code}</span>
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium">项目名称：</span>
                  <span className="font-medium text-slate-800">{project.name}</span>
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium">归档原因：</span>
                  <span className="text-slate-800">{project.archiveReason || '项目已完成'}</span>
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <p>审批通过后，项目将移至已归档列表。</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-smooth"
              >
                驳回申请
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-smooth"
              >
                审批通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗（仅管理员可见） */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-red-600 text-base flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                永久删除项目
              </h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-smooth"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">项目编号：</span>
                  <span className="font-mono text-slate-800">{project.code}</span>
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium">项目名称：</span>
                  <span className="font-medium text-slate-800">{project.name}</span>
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium">关联任务：</span>
                  <span className="text-slate-800">{projectTasks.length} 个</span>
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
                <p className="font-semibold">⚠️ 危险操作，删除后无法恢复！</p>
                <p>• 项目将被永久删除</p>
                <p>• 关联的 {projectTasks.length} 个任务、里程碑、文档、风险、资源都将被级联删除</p>
                <p>• 建议优先使用「归档」功能</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-smooth"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-smooth flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
