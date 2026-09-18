/**
 * API Client for Project Workbench
 * 前端与后端 API 交互的封装层
 */

// 默认使用相对路径 /api，由 vite 开发服务器代理到后端（localhost:3000），
// 这样局域网内其他电脑访问时无需把后端地址硬编码成本机 IP，也不会触发 CORS。
// 生产部署可通过环境变量 VITE_API_URL 覆盖为绝对地址。
const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
    constructor() {
        this.baseURL = API_BASE;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                // S5：自定义头作为 CSRF 纵深防御，后端对写请求校验此头
                'X-Workbench': '1',
                ...options.headers,
            },
            // 身份由后端 HttpOnly 会话 cookie（workbench_session）自动携带，
            // 客户端不再手动发送 x-user-id 头，防止身份伪造。
            credentials: 'include',
            ...options,
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                // 401 表示会话失效，交由上层提示重新登录
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

    // 项目合并 - 撤销日志查询（可按 targetId/sourceId 过滤，返回未撤销且未过期的可撤销项）
    async getMerges({ targetId, sourceId } = {}) {
        const params = new URLSearchParams();
        if (targetId) params.set('targetId', targetId);
        if (sourceId) params.set('sourceId', sourceId);
        const qs = params.toString();
        return this.request(`/merges${qs ? `?${qs}` : ''}`);
    }

    // 项目合并 - 撤销（24h 限时回滚）
    async undoMerge(mergeId) {
        return this.request(`/merges/${mergeId}/undo`, {
            method: 'POST',
        });
    }

    // 子树查询（含全部子孙）
    async getProjectSubtree(id) {
        return this.request(`/projects/${id}/subtree`);
    }

    // 按父过滤获取子项目（parentId=__root__ 取根项目；null/undefined 也显式映射为 __root__，
    // 避免静默下发全部项目——M2 修复：原 null→'' 会让后端返回所有项目）
    async getProjectChildren(parentId) {
        const query = parentId == null ? '?parentId=__root__' : `?parentId=${encodeURIComponent(parentId)}`;
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

    // 任务变更申请（修改计划/废止）- POST /api/tasks/:id/change-request
    async requestTaskChange(id, data) {
        return this.request(`/tasks/${id}/change-request`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // 任务变更评审（通过/驳回）- POST /api/tasks/:id/change-review
    async reviewTaskChange(id, data) {
        return this.request(`/tasks/${id}/change-review`, {
            method: 'POST',
            body: JSON.stringify(data),
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

    // 管理员重置成员密码（按 邮箱@前缀+Yj1018! 规则，后端持久化）
    async resetMemberPassword(id) {
        return this.request(`/members/${id}/reset-password`, {
            method: 'PUT',
        });
    }

    // 当前用户修改密码：后端 /auth/change-password 校验原密码 + 复杂度（S2），前端不持有明文
    async changePassword(oldPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ oldPassword, newPassword }),
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

    // 邮箱密码登录：成功后后端种 workbench_session HttpOnly cookie
    async login(email, password) {
        const response = await fetch(`${this.baseURL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Workbench': '1' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });
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

    // 登出：通知后端撤销会话并清 cookie
    async logout() {
        try {
            const response = await fetch(`${this.baseURL}/auth/logout`, {
                method: 'POST',
                headers: { 'X-Workbench': '1' },
                credentials: 'include',
            });
            return await response.json();
        } catch {
            return { success: false };
        }
    }

    // ===== SSO 单点登录 =====
    // 消费 HttpOnly Cookie 中的一次性 ticket（SSO 302 后由浏览器自动携带，无需在 URL 传参）
    // 成功后后端种 workbench_session 会话 cookie，后续 API 请求自动携带
    async ssoConsume() {
        const response = await fetch(`${this.baseURL}/auth/me`, { method: 'GET', headers: { 'X-Workbench': '1' }, credentials: 'include' });
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

    // ===== 项目群聊（即时通讯）=====
    // 说明：SSE 长连接不走本封装（EventSource 无法自定义请求头），由 useChatRealtime 直接建立。

    // 当前用户的全部群（含未读、最后一条消息）
    async getChatConversations() {
        return this.request('/chat/conversations');
    }

    // 分页拉历史消息（不传 before 取最近 limit 条，返回 { messages, hasMore }，升序）
    async getChatMessages(projectId, { before, limit } = {}) {
        const params = new URLSearchParams();
        if (before) params.set('before', before);
        if (limit) params.set('limit', String(limit));
        const qs = params.toString();
        return this.request(`/chat/projects/${encodeURIComponent(projectId)}/messages${qs ? `?${qs}` : ''}`);
    }

    // 发送消息：body { content, mentions, replyToId }；返回新消息对象
    async sendChatMessage(projectId, { content, mentions, replyToId } = {}) {
        return this.request(`/chat/projects/${encodeURIComponent(projectId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content, mentions, replyToId }),
        });
    }

    // 标记已读：更新指定群的已读游标
    async markChatRead(projectId, lastReadAt) {
        return this.request(`/chat/projects/${encodeURIComponent(projectId)}/read`, {
            method: 'PUT',
            body: JSON.stringify({ lastReadAt }),
        });
    }

    // 未读汇总：{ total, byProject, mentionByProject }
    async getChatUnread() {
        return this.request('/chat/unread');
    }

    // 撤回消息（发送者本人或 admin，5 分钟内）
    async recallChatMessage(messageId) {
        return this.request(`/chat/messages/${encodeURIComponent(messageId)}`, {
            method: 'DELETE',
        });
    }

    // ===== 单聊（V2）=====
    // 说明：单聊同样走 /api/chat 前缀，SSE 复用 /chat/stream 长连接（dmessage/drecall 事件）。

    // 当前用户的单聊会话列表（含未读与最后一条消息）
    // project 可选：传了按项目过滤，不传返回全部（含旧数据 null 桶）
    async getDirectConversations(project) {
        const qs = project ? `?project=${encodeURIComponent(project)}` : '';
        return this.request(`/chat/directs${qs}`);
    }

    // 分页拉单聊历史（双向，返回 { messages, hasMore }，升序）
    // project 可选：传了按项目过滤，不传返回该 peer 全量（旧数据兜底，不 404）
    async getDirectMessages(peerId, { before, limit, project } = {}) {
        const params = new URLSearchParams();
        if (before) params.set('before', before);
        if (limit) params.set('limit', String(limit));
        if (project) params.set('project', project);
        const qs = params.toString();
        return this.request(`/chat/directs/${encodeURIComponent(peerId)}/messages${qs ? `?${qs}` : ''}`);
    }

    // 发送单聊消息：body { content, replyToId, projectId }；projectId 必填（项目隔离维度）
    // 返回新消息对象（自动带 projectId）
    async sendDirectMessage(peerId, { content, replyToId, projectId } = {}) {
        return this.request(`/chat/directs/${encodeURIComponent(peerId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content, replyToId, projectId }),
        });
    }

    // 标记单聊已读：更新指定对方在指定项目下的已读游标（三元组 userId+peerId+projectId）
    async markDirectRead(peerId, lastReadAt, projectId) {
        return this.request(`/chat/directs/${encodeURIComponent(peerId)}/read`, {
            method: 'PUT',
            body: JSON.stringify({ lastReadAt, projectId }),
        });
    }

    // 撤回单聊消息（发送者本人或 admin，5 分钟内）
    async recallDirectMessage(messageId) {
        return this.request(`/chat/directs/messages/${encodeURIComponent(messageId)}`, {
            method: 'DELETE',
        });
    }
}

export const apiClient = new ApiClient();
export default apiClient;
