/**
 * 数据字典 Store - 项目类型 + 项目阶段（级联）
 */
import { create } from 'zustand';
import { apiClient } from '@/lib/apiClient';

export const useDictionaryStore = create((set, get) => ({
    projectTypes: [],
    projectStages: [],
    loading: false,

    // 加载项目类型
    fetchProjectTypes: async () => {
        set({ loading: true });
        try {
            const projectTypes = await apiClient.getProjectTypes();
            set({ projectTypes, loading: false });
            return projectTypes;
        } catch (err) {
            set({ loading: false });
            console.error('[Dictionary] 加载项目类型失败:', err);
            throw err;
        }
    },

    // 加载项目阶段（可按项目类型过滤）
    fetchProjectStages: async (projectTypeId) => {
        set({ loading: true });
        try {
            const projectStages = await apiClient.getProjectStages(projectTypeId);
            if (projectTypeId) {
                // 局部更新：保持已有阶段，合并该类型下的阶段
                const others = get().projectStages.filter(s => s.projectTypeId !== projectTypeId);
                set({ projectStages: [...others, ...projectStages], loading: false });
            } else {
                set({ projectStages, loading: false });
            }
            return projectStages;
        } catch (err) {
            set({ loading: false });
            console.error('[Dictionary] 加载项目阶段失败:', err);
            throw err;
        }
    },

    // 添加项目类型
    addProjectType: async (data) => {
        const pt = await apiClient.createProjectType(data);
        set((state) => ({ projectTypes: [...state.projectTypes, pt] }));
        return pt;
    },

    // 更新项目类型
    updateProjectType: async (id, data) => {
        const updated = await apiClient.updateProjectType(id, data);
        set((state) => ({
            projectTypes: state.projectTypes.map((t) => (t.id === id ? updated : t)),
        }));
        return updated;
    },

    // 删除项目类型（级联删除其阶段）
    deleteProjectType: async (id) => {
        await apiClient.deleteProjectType(id);
        set((state) => ({
            projectTypes: state.projectTypes.filter((t) => t.id !== id),
            projectStages: state.projectStages.filter((s) => s.projectTypeId !== id),
        }));
    },

    // 添加项目阶段
    addProjectStage: async (data) => {
        const stage = await apiClient.createProjectStage(data);
        set((state) => ({ projectStages: [...state.projectStages, stage] }));
        return stage;
    },

    // 更新项目阶段
    updateProjectStage: async (id, data) => {
        const updated = await apiClient.updateProjectStage(id, data);
        set((state) => ({
            projectStages: state.projectStages.map((s) => (s.id === id ? updated : s)),
        }));
        return updated;
    },

    // 删除项目阶段
    deleteProjectStage: async (id) => {
        await apiClient.deleteProjectStage(id);
        set((state) => ({
            projectStages: state.projectStages.filter((s) => s.id !== id),
        }));
    },

    // 根据项目类型 ID 获取其阶段
    getStagesByType: (projectTypeId) => {
        return get().projectStages.filter((s) => s.projectTypeId === projectTypeId);
    },

    // 根据阶段 ID 获取阶段名称
    getStageName: (id) => {
        const stage = get().projectStages.find((s) => s.id === id);
        return stage?.name || '';
    },

    // 根据类型 ID 获取类型名称
    getTypeName: (id) => {
        const type = get().projectTypes.find((t) => t.id === id);
        return type?.name || '';
    },
}));