import { useParams, useNavigate } from 'react-router-dom';
import { useTodoStore } from '@/store/useTodoStore';
import { useAuthStore } from '@/store/useAuthStore';
import TodoForm from '@/components/todos/TodoForm';
import EmptyState from '@/components/ui/EmptyState';

// 待办直达页：责任人通过轻流推送链接跳转而来，自动定位到对应待办的编辑弹窗（可关闭 / 修改）。
export default function TodoDetailPage() {
  const { todoId } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const todo = useTodoStore((s) => s.todos.find((t) => t.id === todoId));

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="请先登录"
        description="登录后即可查看并处理该待办"
        actionLabel="去登录"
        onAction={() => navigate('/login')}
      />
    );
  }

  if (!todo) {
    return (
      <EmptyState
        title="待办未找到"
        description="待办可能已被删除、关闭，或当前账号无权访问"
        actionLabel="返回仪表盘"
        onAction={() => navigate('/')}
      />
    );
  }

  // 关闭时回项目详情页（若有 projectId），否则回仪表盘
  const handleClose = () => {
    if (todo.projectId) {
      navigate(`/projects/${todo.projectId}`);
    } else {
      navigate('/');
    }
  };

  // 复用 TodoForm（编辑模式 = 同一个 Modal）
  return <TodoForm todo={todo} onClose={handleClose} />;
}
