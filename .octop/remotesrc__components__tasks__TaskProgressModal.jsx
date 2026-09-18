import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Check, Plus, X, Calendar, User, Flag, CheckCircle2, Paperclip, FileText } from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useAccess } from '@/hooks/useAccess';
import DocumentForm from '@/components/documents/DocumentForm';
import TodoForm from '@/components/todos/TodoForm';

// 文档选择弹窗：勾选要关联的文档，点击"完成关联"一次性批量关联
function DocSelectorModal({ task, onClose, onLink, projects }) {
  const documents = useDocumentStore((s) => s.documents);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  // 勾选的文档 id（多选）
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // 打开弹窗时已存在的文档 id，用于识别"新建"的文档并自动勾选
  const knownDocIdsRef = useRef(new Set(documents.map((d) => d.id)));

  // 只筛选当前任务的所属项目文档
  const projectDocs = documents.filter((d) => d.projectId === task.projectId);
  const filteredDocs = projectDocs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );
  const linkedIds = new Set(task.documentLinks?.map((l) => l.id) || []);

  // 切换勾选状态
  const toggleSelect = (docId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  // 新建文档表单关闭：自动勾选刚新建的文档，并回到列表
  const handleDocFormClose = () => {
    const newDocs = documents.filter(
      (d) => !knownDocIdsRef.current.has(d.id) && d.projectId === task.projectId
    );
    if (newDocs.length > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        newDocs.forEach((d) => next.add(d.id));
        return next;
      });
    }
    knownDocIdsRef.current = new Set(documents.map((d) => d.id));
    setShowForm(false);
  };

  // 完成关联：把所有勾选且未关联的文档一次性关联，然后关闭弹窗
  const handleConfirm = () => {
    const docs = documents.filter(
      (d) => selectedIds.has(d.id) && !linkedIds.has(d.id)
    );
    if (docs.length > 0) onLink(docs);
    onClose();
  };

  if (showForm) {
    return (
      <DocumentForm
        onClose={handleDocFormClose}
        projects={projects}
        document={null}
        defaultProjectId={task.projectId}
      />
    );
  }

  return (
    <Modal title="关联文档" onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* 搜索 */}
        <Input
          placeholder="搜索文档..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* 文档列表（多选勾选） */}
        <div className="max-h-60 overflow-y-auto space-y-2">
          {filteredDocs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">暂无文档</p>
          ) : (
            filteredDocs.map((doc) => {
              const linked = linkedIds.has(doc.id);
              const selected = selectedIds.has(doc.id);
              return (
                <div
                  key={doc.id}
                  onClick={() => !linked && toggleSelect(doc.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    linked
                      ? 'bg-slate-50 text-slate-400 cursor-default'
                      : selected
                        ? 'bg-blue-50 border border-blue-200 text-slate-700 cursor-pointer'
                        : 'hover:bg-blue-50 text-slate-700 cursor-pointer'
                  }`}
                >
                  {/* 勾选框 */}
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      linked
                        ? 'border-slate-200 bg-slate-100'
                        : selected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-slate-300'
                    }`}
                  >
                    {(selected || linked) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-slate-400">{doc.category || '未分类'}</p>
                  </div>
                  {linked && <span className="text-xs text-green-600">已关联</span>}
                </div>
              );
            })
          )}
        </div>

        {/* 关联提示 + 按钮 */}
        <div className="pt-2 border-t">
          <p className="text-xs text-slate-500 mb-2">
            {selectedIds.size > 0
              ? `已勾选 ${selectedIds.size} 个文档，点击"完成关联"添加到任务文档`
              : '勾选要关联的文档，或新建文档后点击"完成关联"'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">取消</Button>
            <Button variant="outline" onClick={() => setShowForm(true)} className="flex-1">
              <Plus className="w-4 h-4 mr-1" />新建文档
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              <Check className="w-4 h-4 mr-1" />完成关联
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function TaskProgressModal({ task, onClose, projects = [] }) {
  const navigate = useNavigate();
  const updateTask = useTaskStore((s) => s.updateTask);
  const todos = useTodoStore((s) => s.todos);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const members = useMemberStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = members.find((m) => m.id === currentUserId);

  // Document management
  const documents = useDocumentStore((s) => s.documents);
  const [docSelectorOpen, setDocSelectorOpen] = useState(false);

  // 权限：仅任务 assignee 才能写汇报/进度；仅项目负责人/admin 才能审批/撤回
  const projectList = useProjectStore((s) => s.projects) || projects;
  const project = (projectList || []).find((p) => p.id === task?.projectId);
  const { canManageProject, canReportTask, canManageTodo } = useAccess();
  const canManageProj = canManageProject(project);
  const canReport = canReportTask(task);

  const [reports, setReports] = useState(task?.progressReports || []);
  const [newReport, setNewReport] = useState({
    content: '',
    progress: 0,
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todoFormOpen, setTodoFormOpen] = useState(false);

  const assignees = (task?.assignees || (task?.assignee ? [task.assignee] : [])).map(
    (id) => members.find((m) => m.id === id)
  ).filter(Boolean);
  const taskTodos = todos.filter((t) => t.taskId === task?.id);

  // 打开弹窗时刷新关联待办与文档（保证删除/新建后数据最新）
  useEffect(() => {
    useTodoStore.getState().fetchTodos();
    useDocumentStore.getState().fetchDocuments();
  }, [task?.id]);

  // 任务关联的文档链接：过滤掉已在文档管理中删除的文档
  const linkedDocs = (task?.documentLinks || []).filter((l) =>
    documents.some((d) => d.id === l.id)
  );

  const handleToggleTodo = async (todoId) => {
    const todo = (todos || []).find((t) => t.id === todoId);
    if (!todo || !canManageTodo(todo)) return; // 仅 todo 的 owner/被分配或项目负责人可切换
    await toggleTodo(todoId);
  };

  // Generate next report number
  const getNextReportNo = () => {
    const existingNos = reports.map((r) => r.no || 0);
    const maxNo = existingNos.length > 0 ? Math.max(...existingNos) : 0;
    return maxNo + 1;
  };

  const handleAddReport = () => {
    if (!canReport) return; // 仅任务 assignee 可添加汇报
    if (!newReport.content.trim()) return;
    const report = {
      id: Date.now(),
      no: getNextReportNo(),
      date: new Date().toISOString().split('T')[0],
      content: newReport.content,
      progress: newReport.progress || 0,
      reporter: currentUser?.name || '当前用户',
      reporterId: currentUserId,
    };
    setReports([...reports, report]);
    setNewReport({ content: '', progress: 0 });
    setShowForm(false);
  };

  const handleStartTask = () => {
    if (!canReport) return; // 仅任务 assignee 可启动
    updateTask(task.id, { status: 'in_progress' });
    onClose();
  };

  const handleSubmitReport = () => {
    if (!canReport) return; // 仅任务 assignee 可保存
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      updateTask(task.id, { progressReports: reports, updatedAt: new Date().toISOString() });
      setSubmitting(false);
      onClose();
    }, 500);
  };

  const handleFinishTask = () => {
    if (!canReport) return; // 仅任务 assignee 可提交审核
    if (!reports.length) {
      alert('请先添加进度汇报');
      return;
    }
    updateTask(task.id, { status: 'review', progressReports: reports, updatedAt: new Date().toISOString() });
    onClose();
  };

  // 评审通过：仅项目负责人/admin 可操作（权限矩阵）
  const handleApproveReview = () => {
    if (!canManageProj) return;
    updateTask(task.id, {
      status: 'done',
      progress: 100,
      reviewInfo: {
        reviewedBy: currentUser?.name || '当前用户',
        reviewedAt: new Date().toISOString(),
        result: 'approved',
      },
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleTodoFormClose = () => {
    setTodoFormOpen(false);
    useTodoStore.getState().fetchTodos();
  };

  const handleRemoveDocLink = (docId) => {
    if (!canReport) return; // 仅任务 assignee 可移除关联文档
    const currentLinks = task?.documentLinks || [];
    updateTask(task.id, {
      documentLinks: currentLinks.filter(l => l.id !== docId),
    });
  };

  const handleOpenDocument = (doc) => {
    navigate(`/documents?projectId=${doc.projectId}&docId=${doc.id}`);
  };

  if (!task) return null;

  return (
    <Modal title={`任务进度汇报 - ${task.title}`} onClose={onClose} size="2xl" scrollable>
      <div className="space-y-4">
        {/* Task Info */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">截止日期: {task.dueDate || '未设置'}</span>
          </div>
          {assignees.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-600">负责人: </span>
              <div className="flex flex-wrap gap-1">
                {assignees.map((m) => (
                  <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded bg-primary-50 text-primary-700 text-xs font-medium">
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content: Left Todo | Right Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Associated Todos */}
          <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">关联待办 ({taskTodos.length})</h4>
              {canReport && (
                <Button size="sm" variant="ghost" onClick={() => setTodoFormOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  新增待办
                </Button>
              )}
            </div>

            <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: '360px' }}>
              {taskTodos.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">暂无关联待办</p>
              ) : (
                taskTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={todo.completed ? 'true' : 'false'}
                      onClick={() => handleToggleTodo(todo.id)}
                      className={`relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors select-none ${
                        todo.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-slate-300 hover:border-primary-500'
                      }`}
                    >
                      {todo.completed ? (
                        <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 pointer-events-none" aria-hidden="true">
                          <polyline points="5 10.5 9 14.5 15.5 7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </button>
                    <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {todo.title}
                    </span>
                    {todo.dueDate && (
                      <span className="text-xs text-slate-400">{todo.dueDate}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Progress Reports */}
          <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">进度汇报记录 ({reports.length})</h4>
              {canReport && (
                <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}>
                  <Plus className="w-3.5 h-3.5" />
                  新增进度汇报
                </Button>
              )}
            </div>

            <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: '360px' }}>
              {/* Progress Report Form */}
              {showForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      汇报内容 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={newReport.content}
                      onChange={(e) => setNewReport({ ...newReport, content: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth resize-none"
                      placeholder="请描述本次工作进展..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddReport}
                      disabled={!newReport.content.trim()}
                    >
                      <Check className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>
              )}

              {/* Progress Reports Table */}
              {reports.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  暂无进度汇报记录
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500">编号</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500">日期</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500">汇报人</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500">汇报内容</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-2 text-xs text-slate-400 font-mono">#{report.no}</td>
                        <td className="py-2 px-2 text-slate-600">{report.date}</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs">
                            {report.reporter}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-700">{report.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Task Documents Section */}
        {task?.projectId && (
          <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-400" />
                任务文档 ({linkedDocs.length})
              </h4>
              {canReport && (
                <Button size="sm" variant="ghost" onClick={() => setDocSelectorOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  添加文档
                </Button>
              )}
            </div>

            <div className="p-3 space-y-2 min-h-[80px] max-h-[160px] overflow-y-auto">
              {linkedDocs.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-4">
                  暂无关联文档，点击"添加文档"关联项目文档
                </div>
              ) : (
                linkedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                  >
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <button
                      onClick={() => handleOpenDocument(doc)}
                      className="flex-1 text-sm text-primary-600 hover:text-primary-700 hover:underline text-left truncate"
                    >
                      {doc.title}
                    </button>
                    {canReport && (
                      <button
                        onClick={() => handleRemoveDocLink(doc.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="移除关联"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Submit/Finish Actions — 按权限矩阵：撤回/启动/保存/提交审核 限 assignee，评审通过 限项目负责人/admin */}
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          {task.status === 'review' && (
            <>
              {/* 撤回提交 = 自己的任务从评审撤回到进行中，仅 assignee 可操作 */}
              {canReport && (
                <Button variant="outline" onClick={() => updateTask(task.id, { status: 'in_progress' })}>
                  撤回提交
                </Button>
              )}
              {/* 评审通过 = 收尾/归档动作，仅项目负责人/admin 可操作 */}
              {canManageProj && (
                <Button variant="success" onClick={handleApproveReview} className="px-6">
                  <CheckCircle2 className="w-4 h-4" />
                  评审通过
                </Button>
              )}
            </>
          )}
          {task.status === 'todo' && canReport && (
            <Button size="sm" onClick={handleStartTask} className="flex-1">
              <Flag className="w-4 h-4" />
              启动任务
            </Button>
          )}
          {canReport && (
            <Button
              variant="success"
              onClick={handleSubmitReport}
              disabled={submitting || task.status === 'done'}
              className="flex-1"
            >
              <Check className="w-4 h-4" />
              {task.status === 'done' ? '已完成' : '保存进度汇报'}
            </Button>
          )}
          {canReport && task.status !== 'todo' && task.status !== 'done' && task.status !== 'review' && (
            <Button variant="outline" onClick={handleFinishTask} className="px-6">
              提交审核
            </Button>
          )}
          {/* 没有任何可操作按钮时给出提示，避免用户迷惑"为什么没按钮" */}
          {!canReport && !canManageProj && (
            <div className="flex-1 text-xs text-slate-400 text-center py-2">
              您没有该任务的写权限：仅项目负责人可评审、仅任务负责人可汇报进度
            </div>
          )}
        </div>
      </div>

      {todoFormOpen && (
        <TodoForm
          onClose={handleTodoFormClose}
          defaultProjectId={task.projectId}
          defaultTaskId={task.id}
        />
      )}

      {/* 文档选择弹窗 */}
      {docSelectorOpen && (
        <DocSelectorModal
          task={task}
          onClose={() => setDocSelectorOpen(false)}
          projects={projects}
          onLink={(docs) => {
            // 从最新 store 状态读取当前链接，避免闭包过期导致批量关联互相覆盖
            const latestTask = useTaskStore.getState().tasks.find((t) => t.id === task.id);
            const currentLinks = latestTask?.documentLinks || task?.documentLinks || [];
            const newLinks = docs
              .filter((doc) => !currentLinks.find((l) => l.id === doc.id))
              .map((doc) => ({ id: doc.id, title: doc.title, url: doc.url }));
            if (newLinks.length > 0) {
              updateTask(task.id, {
                documentLinks: [...currentLinks, ...newLinks],
              });
            }
          }}
        />
      )}
    </Modal>
  );
}
