/**
 * useChatRealtime - 群聊实时连接（SSE）
 *
 * 职责：
 *   1. 登录时建立 SSE 长连接，登出 / 切换账号时断开并重置状态
 *   2. 收到 message 事件 → 入库；必要时（非当前会话 / 页面不可见）弹桌面通知 + 提示音
 *   3. SSE 不可用（onerror / CLOSED）→ 降级为 15s 轮询 fetchUnread 兜底
 *   4. 回到前台（visibilitychange）时对齐一次未读
 *   5. 首次进入若桌面通知未授权，在用户首次点击时请求授权（不自动弹窗）
 *
 * 该 Hook 在 Layout 中挂载一次，全站生效。
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const POLL_MS = 15000;      // 降级轮询间隔
const RECONNECT_MS = 5000;  // 断开后手动重连等待
const AUTH_FAIL_LIMIT = 3;  // 连续鉴权失败上限：达到后停止 SSE 重连与降级轮询

/**
 * 合成提示音（Web Audio API，无需音频文件）。
 */
function playDing() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    setTimeout(() => ctx.close(), 500);
  } catch (err) {
    // 浏览器可能因用户未交互而拒绝创建 AudioContext，忽略
  }
}

export function useChatRealtime() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const esRef = useRef(null);
  const pollRef = useRef(null);
  const reconnectRef = useRef(null);
  const mountedUserRef = useRef(null);
  const authFailRef = useRef(0); // 连续鉴权(401)失败计数

  useEffect(() => {
    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        const st = useChatStore.getState();
        st.fetchUnread();
        st.fetchConversations();
        st.fetchDirectConversations();
      }, POLL_MS);
    };
    const clearReconnect = () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
    const closeEs = () => {
      if (esRef.current) {
        try { esRef.current.close(); } catch (e) { /* ignore */ }
        esRef.current = null;
      }
    };

    // ---- 未登录：断开并重置 ----
    if (!isAuthenticated || !currentUserId) {
      closeEs();
      stopPolling();
      clearReconnect();
      const st = useChatStore.getState();
      st.setSSEConnected(false);
      if (mountedUserRef.current) {
        st.refreshActiveUser();
        mountedUserRef.current = null;
      }
      return undefined;
    }

    // ---- 已登录：重置后建立连接 ----
    const store = useChatStore.getState();
    store.refreshActiveUser();
    store.fetchUnread();
    store.fetchConversations();
    store.fetchDirectConversations();
    mountedUserRef.current = currentUserId;

    /** 桌面通知 + 提示音（群聊） */
    const notify = (msg) => {
      const st = useChatStore.getState();
      const shouldNotify = document.hidden || st.activeProjectId !== msg.projectId;
      if (!shouldNotify) return;
      const conv = (st.conversations || []).find((c) => c.projectId === msg.projectId);
      const projectName = (conv && conv.projectName) || '项目群聊';
      const mentioned = Array.isArray(msg.mentions) && msg.mentions.includes(currentUserId);

      if (st.settings && st.settings.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          // eslint-disable-next-line no-new
          new Notification(mentioned ? `[有人@你] ${projectName}` : projectName, {
            body: `${msg.senderName || ''}：${String(msg.content || '').slice(0, 60)}`,
            tag: `chat-${msg.projectId}`,
          });
        } catch (e) { /* 忽略通知失败 */ }
      }
      if (st.settings && st.settings.sound) playDing();
    };

    /** 桌面通知 + 提示音（V2 单聊；按 peer + 项目维度判定"当前会话"） */
    const notifyDirect = (msg) => {
      const st = useChatStore.getState();
      const peerId = String(msg.fromId) === String(currentUserId) ? msg.toId : msg.fromId;
      const pProj = msg.projectId == null ? null : msg.projectId;
      // 当前活动会话为 (activePeerId, activePeerProjectId) 二元组；不在其中或页面隐藏才提示
      const shouldNotify = document.hidden
        || st.activePeerId !== peerId
        || st.activePeerProjectId !== pProj;
      if (!shouldNotify) return;
      const conv = (st.directConversations || []).find(
        (c) => c.peerId === peerId && c.projectId === pProj
      );
      const peerName = (conv && conv.peerName) || msg.senderName || '成员';

      if (st.settings && st.settings.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          // eslint-disable-next-line no-new
          new Notification(`${msg.senderName || peerName} 给你发来消息`, {
            body: String(msg.content || '').slice(0, 60),
            // 复合 tag：项目维度区分通知（旧事件无 projectId 归 null 桶）
            tag: `direct-${peerId}#${pProj == null ? '' : pProj}`,
          });
        } catch (e) { /* 忽略通知失败 */ }
      }
      if (st.settings && st.settings.sound) playDing();
    };

    const connect = () => {
      closeEs();
      let es;
      try {
        es = new EventSource(`${API_BASE}/chat/stream`, { withCredentials: true });
      } catch (e) {
        // 构造失败（极老浏览器）：直接降级轮询
        startPolling();
        return;
      }
      esRef.current = es;

      es.onopen = () => {
        authFailRef.current = 0; // 连接恢复即清零
        useChatStore.getState().setSSEConnected(true);
        stopPolling();
      };
      es.addEventListener('ready', () => {
        authFailRef.current = 0;
        useChatStore.getState().setSSEConnected(true);
        stopPolling();
      });
      es.addEventListener('message', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          useChatStore.getState().receiveMessage(msg);
          notify(msg);
        } catch (e) { /* 忽略异常帧 */ }
      });
      es.addEventListener('recall', (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          useChatStore.getState().applyRecallLocal(payload.projectId, payload.id);
          useChatStore.getState().fetchConversations();
        } catch (e) { /* 忽略异常帧 */ }
      });
      // V2 单聊：新消息
      es.addEventListener('dmessage', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          useChatStore.getState().receiveDirect(msg);
          notifyDirect(msg);
        } catch (e) { /* 忽略异常帧 */ }
      });
      // V2 单聊：撤回（多端同步）
      es.addEventListener('drecall', (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          useChatStore.getState().applyDirectRecall(payload);
          useChatStore.getState().fetchDirectConversations();
        } catch (e) { /* 忽略异常帧 */ }
      });
      es.onerror = () => {
        useChatStore.getState().setSSEConnected(false);
        startPolling();
        // EventSource 会在 CONNECTING 态自动重连；CLOSED 态需手动重连
        if (es.readyState === EventSource.CLOSED) {
          closeEs();
          clearReconnect();
          // 探测身份：401 视为会话失效，连续达上限后停止重连与轮询，避免长期空打 401
          fetch(`${API_BASE}/chat/unread`, { credentials: 'include' })
            .then((r) => {
              if (r.status === 401) {
                authFailRef.current += 1;
                if (authFailRef.current >= AUTH_FAIL_LIMIT) {
                  stopPolling();
                  clearReconnect();
                  console.warn('[chat] 会话已失效，已停止群聊实时连接，请重新登录');
                  return;
                }
              }
              // 未达上限 或 非 401：维持现有重连逻辑
              reconnectRef.current = setTimeout(connect, RECONNECT_MS);
            })
            .catch(() => {
              // 网络错误（非鉴权失败）：不计数，按原逻辑重连
              reconnectRef.current = setTimeout(connect, RECONNECT_MS);
            });
        }
      };
    };

    connect();

    // ---- 页面回到前台：对齐未读 + 会话恢复自愈 ----
    const onVisibility = () => {
      if (!document.hidden) {
        authFailRef.current = 0; // 回到前台重置计数（用户可能已重新登录）
        const st = useChatStore.getState();
        st.fetchUnread();
        st.fetchConversations();
        st.fetchDirectConversations();
        // 若此前因鉴权失败已停止重连（无连接且未轮询），切回前台时尝试重连一次
        if (esRef.current === null && !pollRef.current) {
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ---- 首次点击请求桌面通知授权（不自动弹）----
    const onFirstClick = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (e) { /* ignore */ }
      }
      document.removeEventListener('click', onFirstClick);
    };
    document.addEventListener('click', onFirstClick);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onFirstClick);
      closeEs();
      stopPolling();
      clearReconnect();
    };
  }, [isAuthenticated, currentUserId]);
}

export default useChatRealtime;
