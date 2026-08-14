/**
 * 统一数据层 - 优先使用 API，降级到 localStorage
 */
import { apiClient } from './apiClient';

const STORE_KEYS = {
  projects: 'pw_projects',
  tasks: 'pw_tasks',
  todos: 'pw_todos',
  members: 'pw_members',
  notifications: 'pw_notifications',
};

const DataLayer = {
  // 尝试从 API 加载，失败则降级到 localStorage
  async load(key) {
    try {
      const data = await apiClient[`get${key.charAt(0).toUpperCase() + key.slice(1)}`]?.();
      if (data) return data;
    } catch (err) {
      console.warn(`[DataLayer] API 加载 ${key} 失败，降级到 localStorage:`, err.message);
    }
    const raw = localStorage.getItem(STORE_KEYS[key]);
    return raw ? JSON.parse(raw) : [];
  },

  // 保存到 API 并同步到 localStorage
  async save(key, data) {
    try {
      await apiClient[`update${key.charAt(0).toUpperCase() + key.slice(1)}`]?.(data);
    } catch (err) {
      console.warn(`[DataLayer] API 保存 ${key} 失败，仅更新 localStorage:`, err.message);
    }
    localStorage.setItem(STORE_KEYS[key], JSON.stringify(data));
  },

  // 初始化所有数据
  async init() {
    const results = {};
    for (const key of Object.keys(STORE_KEYS)) {
      results[key] = await this.load(key);
    }
    return results;
  },
};

export default DataLayer;
