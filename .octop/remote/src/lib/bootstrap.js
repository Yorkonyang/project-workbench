/**
 * 切换账号后的数据重置与刷新工具
 *
 * 问题背景：
 *  - 各数据 store（projects/tasks/todos/milestones/documents/risks/resources）启用了
 *    zustand persist 中间件，会把数据写入 localStorage。
 *  - App 仅在 mount 时清缓存并 loadFromApi；用户在已登录状态下切换账号（不刷新），
 *    旧账号的数据仍残留在 store 内存中，前端会继续显示给新账号。
 *  - 即使刷新页面，App mount 时清 localStorage 仍晚于 store 的 hydration，旧值可能
 *    在首屏短暂闪现。
 *
 * 解法：
 *  - 登录/切换账号成功后，先 clearStorage 重置 store state + 清 localStorage，
 *    再重新调用各 fetch*（身份由后端 HttpOnly 会话 cookie 自动携带，
 *    由后端 accessControl 完成可见性过滤，前端不再发送 x-user-id 头）。
 */
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { useMilestoneStore } from '@/store/useMilestoneStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useRiskStore } from '@/store/useRiskStore';
import { useResourceStore } from '@/store/useResourceStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useAuthStore } from '@/store/useAuthStore';

const DATA_STORES = [
    useProjectStore,
    useTaskStore,
    useTodoStore,
    useMilestoneStore,
    useDocumentStore,
    useRiskStore,
    useResourceStore,
];

// 清空数据 store 的 localStorage 缓存并重置 state 到 initial，
// 防止切换账号时旧账号的数据残留。
export async function clearDataStores() {
    await Promise.all(
        DATA_STORES.map((s) =>
            s.persist && typeof s.persist.clearStorage === 'function'
                ? s.persist.clearStorage()
                : Promise.resolve()
        )
    );
    // clearStorage 已将 state 重置为 initial（projects=[] 等），
    // 通知 store 不参与持久化但同样清空
    try {
        useNotificationStore.setState({ notifications: [] });
    } catch (e) { /* ignore */ }
}

// 用当前 currentUserId 重新拉取所有数据（身份由会话 cookie 携带，后端按 cookie 过滤）
export async function refreshAllData() {
    const userId = useAuthStore.getState().currentUserId;
    await Promise.all([
        useProjectStore.getState().fetchProjects(),
        useTaskStore.getState().fetchTasks(),
        useTodoStore.getState().fetchTodos(),
        useMilestoneStore.getState().fetchMilestones(),
        useDocumentStore.getState().fetchDocuments(),
        useRiskStore.getState().fetchRisks(),
        useResourceStore.getState().fetchResources(),
    ]);
    if (userId) {
        await useNotificationStore.getState().fetchNotifications(userId);
    }
}

// 登录后：清缓存 + 刷新 + 通知
export async function bootstrapAfterLogin() {
    await clearDataStores();
    await refreshAllData();
}

// 登出后：清缓存（防止账号切换残留）
export async function bootstrapAfterLogout() {
    await clearDataStores();
}