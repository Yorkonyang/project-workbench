import { useParams, useNavigate } from 'react-router-dom';
import { useTaskStore } from '@/store/useTaskStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuthStore } from '@/store/useAuthStore';
import TaskProgressModal from '@/components/tasks/TaskProgressModal';
import EmptyState from '@/components/ui/EmptyState';

// 任务直达页：责任人通过轻流推送链接跳转而来，自动定位到对应任务的详情（进度汇报 + 待办）。
export default function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId));
  const projects = useProjectStore((s) => s.projects);

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="请先登录"
        description="登录后即可查看并处理该任务"
        actionLabel="去登录"
        onAction={() => navigate('/login')}
      />
    );
  }

  if (!task) {
    return (
      <EmptyState
        title="任务未找到"
        description="任务可能已被删除，或当前账号无权访问该项目"
        actionLabel="返回仪表盘"
        onAction={() => navigate('/')}
      />
    );
  }

  // 关闭时回项目详情页（若有 projectId），否则回仪表盘
  const handleClose = () => {
    if (task.projectId) {
      navigate(`/projects/${task.projectId}`);
    } else {
      navigate('/');
    }
  };

  // 与 TasksPage 一致：使用统一的 TaskProgressModal（size=2xl，包含关联待办/进度汇报/任务文档）
  return <TaskProgressModal task={task} projects={projects} onClose={handleClose} />;
}
