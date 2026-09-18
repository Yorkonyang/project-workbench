/**
 * Organization Store - 组织架构（部门）状态管理
 * 连接后端 API，支持 CRUD
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

export const useOrgStore = create(
  persist(
    (set, get) => ({
      departments: [],
      loading: false,

      // 从 API 加载组织架构
      fetchDepartments: async () => {
        set({ loading: true });
        try {
          const departments = await apiClient.getDepartments();
          set({ departments, loading: false });
        } catch (err) {
          console.error('Failed to fetch departments:', err);
          set({ loading: false });
        }
      },

      // 创建部门
      addDepartment: async (data) => {
        const dept = await apiClient.createDepartment(data);
        set((state) => ({ departments: [...state.departments, dept] }));
        return dept;
      },

      // 更新部门
      updateDepartment: async (id, data) => {
        const dept = await apiClient.updateDepartment(id, data);
        set((state) => ({
          departments: state.departments.map((d) =>
            d.id === id ? { ...d, children: d.children || [] } : d
          ),
        }));
        return dept;
      },

      // 删除部门（级联）
      deleteDepartment: async (id) => {
        await apiClient.deleteDepartment(id);
        set((state) => ({
          departments: removeDeptRecursive(state.departments, id),
        }));
      },

      // 获取完整部门列表（扁平化）
      getAllDepartments: () => {
        return flattenTree(get().departments);
      },

      // 获取部门名称
      getDeptName: (id) => {
        const allDepts = get().getAllDepartments();
        return allDepts.find((d) => d.id === id)?.name || '未分配部门';
      },
    }),
    {
      name: 'pw_departments',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * 递归从树中移除指定部门及其子部门
 */
function removeDeptRecursive(depts, id) {
  return depts
    .filter((d) => d.id !== id)
    .map((d) => ({
      ...d,
      children: removeDeptRecursive(d.children || [], id),
    }));
}

/**
 * 树形结构扁平化为数组
 */
function flattenTree(tree) {
  const result = [];
  function traverse(nodes) {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  }
  traverse(tree);
  return result;
}