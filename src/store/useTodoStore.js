/**
 * Todo Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

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
          set({ todos, loading: false });
        } catch (err) {
          console.error('Failed to fetch todos:', err);
          set({ loading: false });
        }
      },

      addTodo: async (data) => {
        const todo = await apiClient.createTodo(data);
        set((state) => ({ todos: [...state.todos, todo] }));
        return todo;
      },

      updateTodo: async (id, data) => {
        const todo = await apiClient.updateTodo(id, data);
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? todo : t)),
        }));
        return todo;
      },

      toggleTodo: async (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;
        const updated = await get().updateTodo(id, {
          completed: !todo.completed,
          completedAt: !todo.completed ? new Date().toISOString() : null,
          completed_at: !todo.completed ? new Date().toISOString() : null,
        });
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
