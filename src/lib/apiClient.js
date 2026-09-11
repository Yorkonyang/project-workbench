/**
 * API Client for Project Workbench
 * 前端与后端 API 交互的封装层
 */

// 默认使用相对路径 /api，由 vite 开发服务器代理到后端（localhost:3000），
// 这样局域网内其他电脑访问时无需把后端地址硬编码成本机 IP，也不会触发 CORS。
// 生产部署可通过环境变量 VITE_API_URL 覆盖为绝对地址。
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// 当前登录用户 id，随每个请求通过 x-user-id 头传给后端，用于项目负责制的归属过滤与写校验
import { useAuthStore } from '@/store/useAuthStore';

class ApiClient {
    constructor() {
        this.baseURL = API_BASE;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const currentUserId = useAuthStore.getState().currentUserId;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUserId || '',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                // 优先透传后端返回的错误消息（如排序号冲突提示）
                let message = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const data = await response.json();
                    if (data && data.error) message = data.error;
                } catch (e) { /* 忽略解析失败 */ }
                throw new Error(message);
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

    // 直接归档（项目负责人一键归档，无需审批）
    async directArchiveProject(id) {
        return this.request(`/projects/${id}/archive-direct`, {
            method: 'POST',
        });
    }

    // Projects
    async getProjects(includeMerged = false) {
        const qs = includeMerged ? '?includeMerged=1' : '';
        return this.request(`/projects${qs}`);
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

    // 项目合并 - 预览（只读，不落库）
    async previewMerge(sourceId, targetId) {
        return this.request(`/projects/${sourceId}/merge-preview?targetId=${encodeURIComponent(targetId)}`);
    }

    // 项目合并 - 执行（原子）
    async mergeProject(sourceId, targetId, strategy = 'keep') {
        return this.request(`/projects/${sourceId}/merge`, {
            method: 'POST',
            body: JSON.stringify({ targetId, strategy }),
        });
    }

    // 子树查询（含全部子孙）
    async getProjectSubtree(id) {
        return this.request(`/projects/${id}/subtree`);
    }

    // 按父过滤获取子项目（parentId=__root__ 取根项目）
    async getProjectChildren(parentId) {
        const query = parentId != null ? `?parentId=${encodeURIComponent(parentId)}` : '';
        return this.request(`/projects${query}`);
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

    // Departments (组织架构)
    async getDepartments() {
        return this.request('/departments');
    }

    async createDepartment(data) {
        return this.request('/departments', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateDepartment(id, data) {
        return this.request(`/departments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteDepartment(id) {
        return this.request(`/departments/${id}`, {
            method: 'DELETE',
        });
    }

    // Excel 导入组织架构和成员
    async importOrganization(data) {
        return this.request('/organization/import', {
            method: 'POST',
            body: JSON.stringify(data),
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

    // ===== 项目类型字典 =====
    async getProjectTypes() {
        return this.request('/project-types');
    }

    async createProjectType(data) {
        return this.request('/project-types', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateProjectType(id, data) {
        return this.request(`/project-types/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteProjectType(id) {
        return this.request(`/project-types/${id}`, {
            method: 'DELETE',
        });
    }

    // ===== 项目阶段字典 =====
    async getProjectStages(projectTypeId) {
        const query = projectTypeId ? `?projectTypeId=${projectTypeId}` : '';
        return this.request(`/project-stages${query}`);
    }

    async createProjectStage(data) {
        return this.request('/project-stages', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateProjectStage(id, data) {
        return this.request(`/project-stages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteProjectStage(id) {
        return this.request(`/project-stages/${id}`, {
            method: 'DELETE',
        });
    }

    // ===== SSO 单点登录 =====
    // 用轻流通知链接中的 u/exp/sig 兑换一次性 ticket（仅用于 SSO 流程，不走 x-user-id 头）
    async ssoExchange(u, exp, sig) {
        const qs = `?u=${encodeURIComponent(u)}&exp=${encodeURIComponent(exp)}&sig=${encodeURIComponent(sig)}`;
        // 注意：ssoExchange 时 currentUserId 尚未设置，不能带 x-user-id 头
        const url = `${this.baseURL}/auth/sso${qs}`;
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
            let message = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                if (data && data.error) message = data.error;
            } catch (e) { /* ignore */ }
            throw new Error(message);
        }
        return await response.json();
    }

    // 用 ticket 校验有效性，返回 userId/email
    async ssoValidate(ticket) {
        const url = `${this.baseURL}/auth/me?ticket=${encodeURIComponent(ticket)}`;
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
            let message = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                if (data && data.error) message = data.error;
            } catch (e) { /* ignore */ }
            throw new Error(message);
        }
        return await response.json();
    }

    // 消费 HttpOnly Cookie 中的一次性 ticket（SSO 302 后由浏览器自动携带，无需在 URL 传参）
    async ssoConsume() {
        const response = await fetch(`${this.baseURL}/auth/me`, { method: 'GET' });
        if (!response.ok) {
            let message = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                if (data && data.error) message = data.error;
            } catch (e) { /* ignore */ }
            throw new Error(message);
        }
        return await response.json();
    }
}

export const apiClient = new ApiClient();
export default apiClient;
