/**
 * 前端权限判定 Hook - 项目负责制
 * 与后端 accessControl.js 保持一致的语义：
 *  - admin：最高权限
 *  - 项目所有者：project.ownerId(创建者) 或 project.manager(指定负责人) 命中当前用户
 *  - 项目成员：任务的 assignees/assignee 含当前用户（或待办 assignee 为自己姓名）
 *  - 成员可汇报自己任务、在自己任务下加待办/文档，但不可编辑/删除项目或任务
 */
import { useAuthStore } from '@/store/useAuthStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useProjectStore } from '@/store/useProjectStore';

export function useAccess() {
    const currentUserId = useAuthStore((s) => s.currentUserId);
    const members = useMemberStore((s) => s.members);
    const projects = useProjectStore((s) => s.projects);

    const me = members.find((m) => m.id === currentUserId) || null;
    const isAdmin = me?.role === 'admin';

    const projectById = (id) => (projects || []).find((p) => p.id === id);
    const isProjectOwner = (project) =>
        !!project && (project.ownerId === currentUserId || project.manager === currentUserId);
    const canManageProject = (project) => isAdmin || isProjectOwner(project);

    // 任务编辑/删除：仅项目所有者（成员不可改任务本身，只能汇报）
    const canManageTask = (task) => {
        if (!task) return false;
        return canManageProject(projectById(task.projectId || task.project_id));
    };

    // 任务进度汇报/加待办/文档：所有者 或 任务责任人(成员)
    const canReportTask = (task) => {
        if (!task) return false;
        if (canManageProject(projectById(task.projectId || task.project_id))) return true;
        if (Array.isArray(task.assignees)) return task.assignees.includes(currentUserId);
        return task.assignee === currentUserId;
    };

    // 待办编辑/删除：项目所有者 或 自己是责任人
    const canManageTodo = (todo) => {
        if (!todo) return false;
        if (todo.projectId && canManageProject(projectById(todo.projectId))) return true;
        return !!me?.name && todo.assignee === me.name;
    };

    // 文档编辑/删除：项目所有者 或 自己创建
    const canManageDocument = (doc) => {
        if (!doc) return false;
        if (doc.projectId && canManageProject(projectById(doc.projectId))) return true;
        return doc.ownerId === currentUserId;
    };

    // 里程碑编辑/删除：项目所有者
    const canManageMilestone = (ms) => {
        if (!ms) return false;
        return canManageProject(projectById(ms.projectId));
    };

    return {
        currentUserId,
        isAdmin,
        canManageProject,
        canManageTask,
        canReportTask,
        canManageTodo,
        canManageDocument,
        canManageMilestone,
    };
}
