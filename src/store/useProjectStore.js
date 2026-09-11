/**
 * Project Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';
import * as hierarchy from '@/lib/hierarchy';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useMilestoneStore } from '@/store/useMilestoneStore';
import { useRiskStore } from '@/store/useRiskStore';
import { useResourceStore } from '@/store/useResourceStore';

export const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: [],
      loading: false,

      // 从 API 加载项目
      fetchProjects: async () => {
        set({ loading: true });
        try {
          const projects = await apiClient.getProjects();
          set({ projects, loading: false });
        } catch (err) {
          console.error('Failed to fetch projects:', err);
          set({ loading: false });
        }
      },

      addProject: async (data) => {
        const project = await apiClient.createProject(data);
        set((state) => ({ projects: [...state.projects, project] }));
        return project;
      },

      // 生成下一个项目编号 XM_001 / XM_002 ...
      generateProjectCode: () => {
        const prefix = 'XM_';
        const existing = get().projects || [];
        const maxNum = existing.reduce((max, p) => {
          const m = (p.code || '').match(/^XM_(\d+)$/);
          if (m) {
            const n = parseInt(m[1], 10);
            return n > max ? n : max;
          }
          return max;
        }, 0);
        return prefix + String(maxNum + 1).padStart(3, '0');
      },

      updateProject: async (id, data) => {
        const project = await apiClient.updateProject(id, data);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
        }));
        return project;
      },

      deleteProject: async (id) => {
        await apiClient.deleteProject(id);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }));
      },

      getActiveProjects: () => get().projects.filter((p) => !p.archived && !p.mergedInto),
      getArchivedProjects: () => get().projects.filter((p) => p.archived && !p.mergedInto),
      getRequestedProjects: () => get().projects.filter((p) => p.archiveStatus === 'requested'),

      // 提交归档申请（ProjectCard 调用此方法）
      requestArchive: async (id, reason, note) => {
        const project = await apiClient.archiveProject(id, reason, note);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
        }));
        return project;
      },

      // 兼容旧调用名
      archiveProject: async (id, reason, note) => {
        return get().requestArchive(id, reason, note);
      },

      approveArchive: async (id) => {
        const result = await apiClient.approveArchive(id);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? result.project : p)),
        }));
        return result;
      },

      rejectArchive: async (id) => {
        const project = await apiClient.rejectArchive(id);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
        }));
        return project;
      },

      restoreProject: async (id) => {
        const result = await apiClient.restoreProject(id);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? result.project : p)),
        }));
        return result;
      },

      // 直接归档（项目负责人一键归档，无需审批）
      // 优先调用 archive-direct 端点；若后端为旧版（无此端点）则回退到审批通过端点
      directArchive: async (id) => {
        try {
          const result = await apiClient.directArchiveProject(id);
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? result.project : p)),
          }));
          return result;
        } catch (err) {
          const result = await apiClient.approveArchive(id);
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? result.project : p)),
          }));
          return result;
        }
      },

      // ===== 项目合并（预览 + 执行）=====
      previewMerge: async (sourceId, targetId) => {
        return apiClient.previewMerge(sourceId, targetId);
      },

      // 执行合并：调后端原子合并，成功后刷新项目与各实体 store（任务/待办/文档/里程碑/风险/资源）
      // 合并是后端单次 saveData，前端无需逐 store 批量改 projectId
      mergeProject: async (sourceId, targetId, strategy = 'keep') => {
        const result = await apiClient.mergeProject(sourceId, targetId, strategy);
        // 刷新全部相关缓存，确保已合并源隐藏、实体归属指向目标
        await get().fetchProjects();
        await useTaskStore.getState().fetchTasks();
        await useTodoStore.getState().fetchTodos();
        await useDocumentStore.getState().fetchDocuments();
        await useMilestoneStore.getState().fetchMilestones();
        await useRiskStore.getState().fetchRisks();
        await useResourceStore.getState().fetchResources();
        return result;
      },

      // 查询某目标项目下可撤销的合并日志（未撤销且 24h 未过期）
      getMerges: async (targetId) => {
        return apiClient.getMerges({ targetId });
      },

      // 撤销合并：调后端回滚，成功后刷新全部相关缓存（源项目复活、实体归属还原、子项目挂接还原）
      undoMerge: async (mergeId) => {
        const result = await apiClient.undoMerge(mergeId);
        await get().fetchProjects();
        await useTaskStore.getState().fetchTasks();
        await useTodoStore.getState().fetchTodos();
        await useDocumentStore.getState().fetchDocuments();
        await useMilestoneStore.getState().fetchMilestones();
        await useRiskStore.getState().fetchRisks();
        await useResourceStore.getState().fetchResources();
        return result;
      },

      // ===== 层级辅助方法（统一委托 hierarchy，避免双真源）=====
      getProjectLevel: (id) => hierarchy.getLevel(get().projects, id),
      getChildren: (id) => hierarchy.getChildren(get().projects, id),
      getDescendants: (id) => hierarchy.getDescendants(get().projects, id),
      getAncestors: (id) => hierarchy.getAncestors(get().projects, id),

      // 合并候选：排除自身/子孙/已归档/已合并
      getMergeCandidates: (id) => {
        const projects = get().projects;
        const subtree = hierarchy.collectSubtree(projects, id);
        return projects.filter(
          (p) => !subtree.has(p.id) && !p.archived && !p.mergedInto
        );
      },

      // 子树聚合统计：按“自身 + 全部子孙的任务完成率”计算进度（不写回 project.progress）
      getSubtreeStats: (id) => {
        const projects = get().projects;
        const tasks = useTaskStore.getState().tasks;
        const project = projects.find((p) => p.id === id);
        if (!project) {
          return { taskTotal: 0, taskDone: 0, progress: 0, incompleteItems: 0, childProjectCount: 0, isLeaf: true, level: 0, code: '', name: '' };
        }
        const subtree = hierarchy.collectSubtree(projects, id);
        const subtreeTasks = (tasks || []).filter((t) => subtree.has(t.projectId || t.project_id));
        const taskTotal = subtreeTasks.length;
        const taskDone = subtreeTasks.filter((t) => t.status === 'done').length;
        const progress = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;
        const childProjectCount = hierarchy.getChildren(projects, id).length;
        return {
          taskTotal,
          taskDone,
          progress,
          incompleteItems: taskTotal - taskDone,
          childProjectCount,
          isLeaf: childProjectCount === 0,
          level: hierarchy.getLevel(projects, id),
          code: project.code,
          name: project.name,
        };
      },
    }),
    {
      name: 'pw_projects',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
