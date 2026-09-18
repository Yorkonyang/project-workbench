/**
 * 数据存储适配器
 * 支持 localStorage 和 API 两种存储后端
 */

import { apiClient } from './apiClient';

class StorageAdapter {
    constructor(mode = 'auto') {
        // mode: 'auto' | 'local' | 'api'
        this.mode = mode;
        this.useApi = mode === 'api' || (mode === 'auto' && this.isServerRunning());
    }

    async isServerRunning() {
        try {
            await apiClient.healthCheck();
            return true;
        } catch {
            return false;
        }
    }

    // Projects
    async getProjects() {
        if (this.useApi) {
            return await apiClient.getProjects();
        }
        const raw = localStorage.getItem('pw_projects');
        return raw ? JSON.parse(raw) : [];
    }

    async createProject(data) {
        if (this.useApi) {
            return await apiClient.createProject(data);
        }
        const projects = this.getProjects();
        const project = { ...data, id: this.generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        projects.push(project);
        localStorage.setItem('pw_projects', JSON.stringify(projects));
        return project;
    }

    async updateProject(id, data) {
        if (this.useApi) {
            return await apiClient.updateProject(id, data);
        }
        const projects = this.getProjects();
        const index = projects.findIndex(p => p.id === id);
        if (index !== -1) {
            projects[index] = { ...projects[index], ...data, updatedAt: new Date().toISOString() };
            localStorage.setItem('pw_projects', JSON.stringify(projects));
            return projects[index];
        }
        return null;
    }

    async deleteProject(id) {
        if (this.useApi) {
            return await apiClient.deleteProject(id);
        }
        const projects = this.getProjects();
        const filtered = projects.filter(p => p.id !== id);
        localStorage.setItem('pw_projects', JSON.stringify(filtered));
        return true;
    }

    // Tasks
    async getTasks(projectId) {
        if (this.useApi) {
            return await apiClient.getTasks(projectId);
        }
        const raw = localStorage.getItem('pw_tasks');
        const tasks = raw ? JSON.parse(raw) : [];
        return projectId ? tasks.filter(t => t.projectId === projectId) : tasks;
    }

    async createTask(projectId, data) {
        if (this.useApi) {
            return await apiClient.createTask(projectId, data);
        }
        const tasks = this.getTasks();
        const task = { ...data, id: this.generateId(), projectId, status: 'todo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        tasks.push(task);
        localStorage.setItem('pw_tasks', JSON.stringify(tasks));
        return task;
    }

    async updateTask(id, data) {
        if (this.useApi) {
            return await apiClient.updateTask(id, data);
        }
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...data, updatedAt: new Date().toISOString() };
            localStorage.setItem('pw_tasks', JSON.stringify(tasks));
            return tasks[index];
        }
        return null;
    }

    // Todos
    async getTodos() {
        if (this.useApi) {
            return await apiClient.getTodos();
        }
        const raw = localStorage.getItem('pw_todos');
        return raw ? JSON.parse(raw) : [];
    }

    async createTodo(data) {
        if (this.useApi) {
            return await apiClient.createTodo(data);
        }
        const todos = this.getTodos();
        const todo = { ...data, id: this.generateId(), completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        todos.push(todo);
        localStorage.setItem('pw_todos', JSON.stringify(todos));
        return todo;
    }

    async updateTodo(id, data) {
        if (this.useApi) {
            return await apiClient.updateTodo(id, data);
        }
        const todos = this.getTodos();
        const index = todos.findIndex(t => t.id === id);
        if (index !== -1) {
            todos[index] = { ...todos[index], ...data, updatedAt: new Date().toISOString() };
            localStorage.setItem('pw_todos', JSON.stringify(todos));
            return todos[index];
        }
        return null;
    }

    async deleteTodo(id) {
        if (this.useApi) {
            return await apiClient.deleteTodo(id);
        }
        const todos = this.getTodos();
        const filtered = todos.filter(t => t.id !== id);
        localStorage.setItem('pw_todos', JSON.stringify(filtered));
        return true;
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
}

export const storage = new StorageAdapter();
export default storage;
