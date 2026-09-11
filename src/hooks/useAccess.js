/**
 * 前端权限判定 hook - 项目负责制
 * 与后端 accessControl.js 保持一致的语义：
 *  - admin：最高权限
 *  - 项目所有者：project.ownerId(创建者) 或 project.manager(指定负责人) 命中当前用户
 *  - 项目成员：任务的 assignees/assignee 含当前用户（或待办 assignee 含自己 id/name）
 *  - 成员可在自己被分配的任务下进行进度汇报、添加待办与项目文档
 */
import { useAuthStore } from '@/store/useAuthStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { collectSubtree } from '@/lib/hierarchy';

export function useAccess() {
    const currentUserId = useAuthStore((s) => s.currentUserId);
    const members = useMemberStore((s) => s.members);
    const projects = useProjectStore((s) => s.projects);
    const tasks = useTaskStore((s) => s.tasks);
    const todos = useTodoStore((s) => s.todos);

    const me = members.find((m) => m.id === currentUserId) || null;
    const myName = me?.name || '';
    const isAdmin = me?.role === 'admin';

    const projectById = (id) => (projects || []).find((p) => p.id === id);
    const isProjectOwner = (project) =>
        !!project && (project.ownerId === currentUserId || project.manager === currentUserId);
    const canManageProject = (project) => isAdmin || isProjectOwner(project);

    // 当前用户是否在此项目下被分配任务（assignee/assignees 含 userId）
    const isAssignedTaskInProject = (projectId) =>
        (tasks || []).some(
            (t) =>
                (t.projectId || t.project_id) === projectId &&
                (Array.isArray(t.assignees)
                    ? t.assignees.includes(currentUserId)
                    : t.assignee === currentUserId)
        );
    // 当前用户是否在此项目下被分配待办（assignee 含 userId/name）
    const isAssignedTodoInProject = (projectId) =>
        (todos || []).some((todo) => {
            if ((todo.projectId || '') !== projectId) return false;
            const a = todo.assignee;
            if (Array.isArray(a)) return a.some((x) => x === currentUserId || x === myName);
            return a === currentUserId || a === myName;
        });

    /**
     * 项目可见性：
     *  - admin：全部可见
     *  - 项目负责人：自己管理/拥有的项目
     *  - 项目成员：在该项目下被分配任务，或被分配待办
     */
    const canViewProject = (project) => {
        if (!project) return false;
        if (isAdmin) return true;
        if (isProjectOwner(project)) return true;
        const pid = project.id;
        if (isAssignedTaskInProject(pid)) return true;
        if (isAssignedTodoInProject(pid)) return true;
        return false;
    };

    // 任务编辑/删除：仅项目所有者（成员不可改任务本身，只能汇报）
    const canManageTask = (task) => {
        if (!task) return false;
        return canManageProject(projectById(task.projectId || task.project_id));
    };

    /**
     * 项目下「任务/时间线/风险/里程碑」内容是否可见：
     *  - admin
     *  - 项目负责人（ownerId 或 manager）
     *  - 被分配任务的成员（项目下存在自己作为 assignee 的任务）
     * 注意：仅被分配待办的成员不可见（不能看其他页面内容）
     */
    const canViewProjectTasks = (project) => {
        if (!project) return false;
        if (isAdmin) return true;
        if (isProjectOwner(project)) return true;
        return isAssignedTaskInProject(project.id);
    };

    // 任务进度汇报/加待办/文档：所有者 或 任务责任人(成员)
    const canReportTask = (task) => {
        if (!task) return false;
        if (canManageProject(projectById(task.projectId || task.project_id))) return true;
        if (Array.isArray(task.assignees)) return task.assignees.includes(currentUserId);
        return task.assignee === currentUserId;
    };

    /**
     * 待办可见性：
     *  - admin/项目所有者：项目下全部可见
     *  - 成员（被分配任务）：仅自己添加的（ownerId=自己）
     *  - 成员（被分配待办）：仅 assignee 命中的
     */
    const canViewTodo = (todo) => {
        if (!todo) return false;
        if (isAdmin) return true;
        const proj = projectById(todo.projectId);
        if (canManageProject(proj)) return true;
        // 自己添加的（ownerId 命中）
        if (todo.ownerId === currentUserId) return true;
        // 自己被分配（assignee 命中 id/name）
        const a = todo.assignee;
        if (Array.isArray(a)) {
            if (a.some((x) => x === currentUserId || x === myName)) return true;
        } else if (a === currentUserId || a === myName) return true;
        return false;
    };

    // 待办编辑/删除：项目所有者 或 自己创建/被分配
    const canManageTodo = (todo) => {
        if (!todo) return false;
        if (todo.projectId && canManageProject(projectById(todo.projectId))) return true;
        return todo.ownerId === currentUserId || todo.assignee === myName || todo.assignee === currentUserId;
    };

    // 文档编辑/删除：项目所有者 或 自己创建
    const canManageDocument = (doc) => {
        if (!doc) return false;
        if (doc.projectId && canManageProject(projectById(doc.projectId))) return true;
        return doc.ownerId === currentUserId;
    };

    /**
     * 文档可见性：
     *  - admin/项目所有者：项目下全部
     *  - 成员：仅自己添加的（ownerId=自己）
     */
    const canViewDocument = (doc) => {
        if (!doc) return false;
        if (isAdmin) return true;
        const proj = projectById(doc.projectId);
        if (canManageProject(proj)) return true;
        return doc.ownerId === currentUserId;
    };

    /**
     * 风险可见性：
     *  - admin/项目所有者：项目下全部可见
     *  - 被分配任务的成员：项目下全部可见
     *  - 仅被分配待办的成员：不可见（不能看其他页面内容）
     */
    const canViewRisk = (risk) => {
        if (!risk) return false;
        if (isAdmin) return true;
        const proj = projectById(risk.projectId);
        return canViewProjectTasks(proj);
    };

    // 里程碑可见性：仅项目可见任务时间线的范围内（owner/admin 或 被分配任务的成员）
    const canViewMilestone = (ms) => {
        if (!ms) return false;
        return canViewProjectTasks(projectById(ms.projectId));
    };

    // 里程碑编辑/删除：项目所有者
    const canManageMilestone = (ms) => {
        if (!ms) return false;
        return canManageProject(projectById(ms.projectId));
    };

    // 合并项目权限：可管理者 + 未归档 + 未合并（与后端 accessControl.canMergeProject 语义一致）
    const canMergeProject = (project) => {
        if (!project) return false;
        if (project.archived) return false;
        if (project.mergedInto) return false;
        return canManageProject(project);
    };

    // 可见项目集合（含可见项目的全部子孙，遵循可见性继承：能看父即能看子）
    const visibleProjectIds = (() => {
        const ids = new Set();
        (projects || []).forEach((p) => {
            if (!p.mergedInto && canViewProject(p)) {
                collectSubtree(projects, p.id).forEach((id) => ids.add(id));
            }
        });
        return ids;
    })();

    return {
        currentUserId,
        me,
        myName,
        isAdmin,
        isProjectOwner,
        canManageProject,
        canMergeProject,
        canViewProject,
        visibleProjectIds,
        canViewProjectTasks,
        canManageTask,
        canReportTask,
        canViewTodo,
        canManageTodo,
        canViewDocument,
        canManageDocument,
        canViewMilestone,
        canManageMilestone,
        canViewRisk,
    };
}