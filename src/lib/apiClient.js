/**
 * API Client for Project Workbench
 * 前端与后端 API 交互的封装层
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
    constructor() {
        this.baseURL = API_BASE;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Projects - 归档相关
    async archiveProject(id, reason, note) {
        return this.request(`/projects/${id}/archive`, {
            method: 'POST',
            body: JSON.stringify({ reason, note }),
        });
    }

    async approveArchive(id) {
        return this.request(`/projects/${id}/approve-archive`, {
            method: 'POST',
        });
    }

    async rejectArchive(id) {
        return this.request(`/projects/${id}/reject-archive`, {
            method: 'POST',
        });
    }

    async restoreProject(id) {
        return this.request(`/projects/${id}/restore`, {
            method: 'POST',
        });
    }

    // Projects
    async getProjects() {
        return this.request('/projects');
    }

    async createProject(data) {
        return this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateProject(id, data) {
        return this.request(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteProject(id) {
        return this.request(`/projects/${id}`, {
            method: 'DELETE',
        });
    }

    // Tasks
    async getTasks(projectId) {
        if (projectId) {
            return this.request(`/projects/${projectId}/tasks`);
        }
        // 获取所有任务
        return this.request('/tasks');
    }

    async getAllTasks() {
        return this.request('/tasks');
    }

    async createTask(projectId, data) {
        return this.request(`/projects/${projectId}/tasks`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateTask(id, data) {
        return this.request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteTask(id) {
        return this.request(`/tasks/${id}`, {
            method: 'DELETE',
        });
    }

    // Todos
    async getTodos() {
        return this.request('/todos');
    }

    async createTodo(data) {
        return this.request('/todos', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateTodo(id, data) {
        return this.request(`/todos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteTodo(id) {
        return this.request(`/todos/${id}`, {
            method: 'DELETE',
        });
    }

    // Members
    async getMembers() {
        return this.request('/members');
    }

    async createMember(data) {
        return this.request('/members', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateMember(id, data) {
        return this.request(`/members/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteMember(id) {
        return this.request(`/members/${id}`, {
            method: 'DELETE',
        });
    }

    // Notifications
    async getNotifications(userId) {
        if (userId) {
            return this.request(`/notifications?userId=${userId}`);
        }
        return this.request('/notifications');
    }

    async createNotification(data) {
        return this.request('/notifications', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async markNotificationRead(id) {
        return this.request(`/notifications/${id}/read`, {
            method: 'PUT',
        });
    }

    async markAllNotificationsRead(userId) {
        return this.request('/notifications/read-all', {
            method: 'PUT',
            body: JSON.stringify({ userId }),
        });
    }

    async deleteNotification(id) {
        return this.request(`/notifications/${id}`, {
            method: 'DELETE',
        });
    }

    async clearReadNotifications(userId) {
        return this.request('/notifications/read', {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
        });
    }

    async clearAllNotifications(userId) {
        return this.request('/notifications/all', {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
        });
    }

    // Risks
    async getRisks() {
        return this.request('/risks');
    }

    async createRisk(data) {
        return this.request('/risks', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateRisk(id, data) {
        return this.request(`/risks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteRisk(id) {
        return this.request(`/risks/${id}`, {
            method: 'DELETE',
        });
    }

    // Resources
    async getResources() {
        return this.request('/resources');
    }

    async createResource(data) {
        return this.request('/resources', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateResource(id, data) {
        return this.request(`/resources/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteResource(id) {
        return this.request(`/resources/${id}`, {
            method: 'DELETE',
        });
    }

    // Milestones
    async getMilestones() {
        return this.request('/milestones');
    }

    async createMilestone(data) {
        return this.request('/milestones', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateMilestone(id, data) {
        return this.request(`/milestones/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteMilestone(id) {
        return this.request(`/milestones/${id}`, {
            method: 'DELETE',
        });
    }

    // Documents
    async getDocuments() {
        return this.request('/documents');
    }

    async createDocument(data) {
        return this.request('/documents', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateDocument(id, data) {
        return this.request(`/documents/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteDocument(id) {
        return this.request(`/documents/${id}`, {
            method: 'DELETE',
        });
    }

    // Health check
    async healthCheck() {
        return this.request('/health');
    }

    // Get stats
    async getStats() {
        return this.request('/stats');
    }

    // ===== 轻流 BPM 集成 =====
    async getQingflowConfig() {
        return this.request('/qingflow/config');
    }

    async setQingflowConfig(config) {
        return this.request('/qingflow/config', {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async testQingflowConnection() {
        return this.request('/qingflow/test');
    }
}

export const apiClient = new ApiClient();
export default apiClient;
