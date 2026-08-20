/**
 * 访问控制模块 - 项目负责制权限模型
 *
 * 权限基准（确认结论）：
 *  - admin：最高权限，可见/管理全部
 *  - 项目所有者：项目的 ownerId(创建者) 或 manager(指定负责人) 命中当前用户，二者都是所有者
 *  - 项目成员：任务的 assignee / assignees 数组含当前用户（或待办 assignee 为当前用户姓名）
 *  - 无关系人：仅可创建项目（创建后自变所有者）
 *
 * 可见性：
 *  - 项目：所有者或 admin 可见
 *  - 任务：所属项目可见 或 自己是任务责任人
 *  - 待办：所属项目可见 或 assignee 为自己姓名
 *  - 文档：所属项目可见 或 ownerId 为自己
 *  - 里程碑：所属项目可见
 */

function getUserId(req, url) {
    // 优先请求头（前端统一附加），其次 query 参数（兼容通知等已有用法）
    const headerVal = req && req.headers ? (req.headers['x-user-id'] || req.headers['X-User-Id']) : null;
    if (headerVal) return String(headerVal);
    if (url && typeof url.searchParams && url.searchParams.get) {
        const q = url.searchParams.get('userId');
        if (q) return String(q);
    }
    return null;
}

function getUserRole(data, userId) {
    if (!userId) return null;
    const m = (data.members || []).find((x) => x.id === userId);
    return m ? m.role : null;
}

function isAdmin(data, userId) {
    return getUserRole(data, userId) === 'admin';
}

function isProjectOwner(project, userId) {
    if (!project || !userId) return false;
    return project.ownerId === userId || project.manager === userId;
}

function canManageProject(data, userId, projectId) {
    if (isAdmin(data, userId)) return true;
    const p = (data.projects || []).find((x) => x.id === projectId);
    return p ? isProjectOwner(p, userId) : false;
}

function getUserName(data, userId) {
    const m = (data.members || []).find((x) => x.id === userId);
    return m ? m.name : null;
}

// 兼容 assignee(单值 id) 与 assignees(数组) 两种写法
function taskAssigneeIncludes(task, userId) {
    if (!task || !userId) return false;
    if (Array.isArray(task.assignees)) return task.assignees.includes(userId);
    return task.assignee === userId;
}

function visibleProjectIds(data, userId) {
    if (isAdmin(data, userId)) return new Set((data.projects || []).map((p) => p.id));
    return new Set(
        (data.projects || [])
            .filter((p) => isProjectOwner(p, userId))
            .map((p) => p.id)
    );
}

function visibleProjects(data, userId) {
    if (isAdmin(data, userId)) return data.projects || [];
    return (data.projects || []).filter((p) => isProjectOwner(p, userId));
}

function visibleTasks(data, userId) {
    if (isAdmin(data, userId)) return data.tasks || [];
    const projIds = visibleProjectIds(data, userId);
    return (data.tasks || []).filter((t) => {
        const pid = t.projectId || t.project_id;
        if (pid && projIds.has(pid)) return true;
        return taskAssigneeIncludes(t, userId);
    });
}

function visibleTodos(data, userId) {
    if (isAdmin(data, userId)) return data.todos || [];
    const projIds = visibleProjectIds(data, userId);
    const name = getUserName(data, userId);
    return (data.todos || []).filter((t) => {
        if (t.projectId && projIds.has(t.projectId)) return true;
        if (name && t.assignee === name) return true;
        return false;
    });
}

function visibleDocuments(data, userId) {
    if (isAdmin(data, userId)) return data.documents || [];
    const projIds = visibleProjectIds(data, userId);
    return (data.documents || []).filter((d) => {
        if (d.projectId && projIds.has(d.projectId)) return true;
        return d.ownerId === userId;
    });
}

function visibleMilestones(data, userId) {
    if (isAdmin(data, userId)) return data.milestones || [];
    const projIds = visibleProjectIds(data, userId);
    return (data.milestones || []).filter((m) => m.projectId && projIds.has(m.projectId));
}

// 写操作校验 ------------------------------------------------------

function canManageTask(data, userId, taskId) {
    if (isAdmin(data, userId)) return true;
    const t = (data.tasks || []).find((x) => x.id === taskId);
    if (!t) return false;
    const pid = t.projectId || t.project_id;
    return canManageProject(data, userId, pid);
}

// 创建任务：仅项目所有者/admin 可建（成员不能在他人项目建任务）
function canCreateTask(data, userId, projectId) {
    if (isAdmin(data, userId)) return true;
    if (!projectId) return false;
    return canManageProject(data, userId, projectId);
}

// 创建待办：所有者/admin 可建；成员仅可在「自己被分配的任务」下加待办
function canCreateTodo(data, userId, body) {
    if (isAdmin(data, userId)) return true;
    if (body && body.projectId && canManageProject(data, userId, body.projectId)) return true;
    if (body && body.taskId) {
        const t = (data.tasks || []).find((x) => x.id === body.taskId);
        if (t && taskAssigneeIncludes(t, userId)) return true;
    }
    return false;
}

// 创建文档：所有者/admin 可建；成员仅可在「自己被分配任务的所属项目」下加自己的文档
function canCreateDocument(data, userId, body) {
    if (isAdmin(data, userId)) return true;
    if (body && body.projectId && canManageProject(data, userId, body.projectId)) return true;
    // 成员：在自己被分配任务的所属项目下添加自己的文档（ownerId=userId）
    if (body && body.projectId) {
        const mine = (data.tasks || []).some(
            (t) => (t.projectId || t.project_id) === body.projectId && taskAssigneeIncludes(t, userId)
        );
        if (mine) return true;
    }
    return false;
}

function canManageTodo(data, userId, todoId) {
    if (isAdmin(data, userId)) return true;
    const t = (data.todos || []).find((x) => x.id === todoId);
    if (!t) return false;
    // 所有者(项目)可删；成员仅能删自己为责任人的待办
    if (t.projectId && canManageProject(data, userId, t.projectId)) return true;
    const name = getUserName(data, userId);
    if (name && t.assignee === name) return true;
    return false;
}

function canManageDocument(data, userId, docId) {
    if (isAdmin(data, userId)) return true;
    const d = (data.documents || []).find((x) => x.id === docId);
    if (!d) return false;
    if (d.projectId && canManageProject(data, userId, d.projectId)) return true;
    return d.ownerId === userId;
}

function canManageMilestone(data, userId, msId) {
    if (isAdmin(data, userId)) return true;
    const m = (data.milestones || []).find((x) => x.id === msId);
    if (!m) return false;
    return canManageProject(data, userId, m.projectId);
}

// 当前用户能否访问某个项目详情（所有者/admin/成员均可，成员用于查看自己任务所属项目上下文）
function canViewProject(data, userId, projectId) {
    if (isAdmin(data, userId)) return true;
    const p = (data.projects || []).find((x) => x.id === projectId);
    if (p && isProjectOwner(p, userId)) return true;
    // 成员：该项目下存在自己被分配的任务
    const mine = (data.tasks || []).some(
        (t) => (t.projectId || t.project_id) === projectId && taskAssigneeIncludes(t, userId)
    );
    return mine;
}

module.exports = {
    getUserId,
    getUserRole,
    isAdmin,
    isProjectOwner,
    canManageProject,
    canManageTask,
    canCreateTask,
    canCreateTodo,
    canCreateDocument,
    canManageTodo,
    canManageDocument,
    canManageMilestone,
    canViewProject,
    visibleProjects,
    visibleTasks,
    visibleTodos,
    visibleDocuments,
    visibleMilestones,
    visibleProjectIds,
    getUserName,
    taskAssigneeIncludes,
};
