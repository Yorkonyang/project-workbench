/**
 * Todo Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

// 归一化 todo 对象：completed 强制 boolean，避免后端返回数字 0 时 React 在 JSX 中渲染出 "0"
// （JSX 中 {0 && X} 会渲染数字 0 本身，而 {false && X} 不会渲染）
const normalizeTodo = (t) => ({
  ...t,
  completed: !!t.completed,
});

export const useTodoStore = create(
  persist(
    (set, get) => ({
      todos: [],
      loading: false,

      // 从 API 加载待办
      fetchTodos: async () => {
        set({ loading: true });
        try {
          const todos = await apiClient.getTodos();
          set({ todos: (todos || []).map(normalizeTodo), loading: false });
        } catch (err) {
          console.error('Failed to fetch todos:', err);
          set({ loading: false });
        }
      },

      addTodo: async (data) => {
        const todo = await apiClient.createTodo(data);
        const normalized = normalizeTodo(todo);
        set((state) => ({ todos: [...state.todos, normalized] }));
        return normalized;
      },

      updateTodo: async (id, data) => {
        const todo = await apiClient.updateTodo(id, data);
        const normalized = normalizeTodo(todo);
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? normalized : t)),
        }));
        return normalized;
      },

      toggleTodo: async (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;
        const wasCompleted = todo.completed;
        const updated = await get().updateTodo(id, {
          completed: !todo.completed,
          completedAt: !todo.completed ? new Date().toISOString() : null,
          completed_at: !todo.completed ? new Date().toISOString() : null,
        });
        // 待办完成时，立即关闭关联风险
        if (!wasCompleted && updated.completed) {
          autoCloseRelatedRisks(updated.id, 'todo', updated.title);
        }
        return updated;
      },

      getTodosByTask: (taskId) =>
        get().todos.filter((t) => t.taskId === taskId),

      deleteTodo: async (id) => {
        await apiClient.deleteTodo(id);
        set((state) => ({
          todos: state.todos.filter((t) => t.id !== id),
        }));
      },

      getActiveTodos: () => get().todos.filter((t) => !t.completed),
      getCompletedTodos: () => get().todos.filter((t) => t.completed),
    }),
    {
      name: 'pw_todos',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
