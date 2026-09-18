/**
 * ChatWindow - 项目群聊 / 单聊 双模式核心组件（消息区 + 输入区 + 提及/引用）
 *
 * Props:
 *   mode         {'project'|'direct'}  会话模式，默认 'project'
 *   projectId    {string}  项目 id（project 模式必填）
 *   peerId       {string}  对方成员 id（direct 模式必填）
 *   peerProjectId {string} 单聊所在项目 id（direct 模式，"在哪个项目下"）
 *   className    {string}  外层样式
 *   height       {string}  容器高度（如 "560px"），默认铺满父容器
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Send,
  RefreshCw,
  Users,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  ArrowDown,
  Loader2,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pinyinMatch } from '@/lib/pinyinMatch';
import { useChatStore, peerKey } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useTaskStore } from '@/store/useTaskStore';
import EmptyState from '@/components/ui/EmptyState';
import MessageBubble from '@/components/chat/MessageBubble';

const GROUP_GAP_MS = 5 * 60 * 1000; // 连续消息分组时间窗
const MAX_AVATARS = 5;              // 头像堆叠上限

/** 把消息列表计算为分组信息：每组首条显示姓名、末条显示时间 */
function buildGroups(messages) {
  return messages.map((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const gapPrev = prev ? new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() : Infinity;
    const gapNext = next ? new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() : Infinity;
    return {
      message: m,
      showSender: !prev || prev.senderId !== m.senderId || gapPrev > GROUP_GAP_MS,
      showTime: !next || next.senderId !== m.senderId || gapNext > GROUP_GAP_MS,
    };
  });
}

export default function ChatWindow({ mode = 'project', projectId, peerId, peerProjectId, className, height }) {
  const isDirect = mode === 'direct';
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const project = useProjectStore((s) => (projectId ? s.projects.find((p) => p.id === projectId) : undefined));
  const allMembers = useMemberStore((s) => s.members);
  const allTasks = useTaskStore((s) => s.tasks);

  // 数据源：按模式选择不同 store 切片（direct 模式用复合 key messagesByPeer[peerKey(peerId, peerProjectId)]）
  const directKey = isDirect ? peerKey(peerId, peerProjectId) : null;
  const messages = useChatStore((s) =>
    isDirect ? (s.messagesByPeer[directKey] || []) : (s.messagesByProject[projectId] || [])
  );
  const hasMore = Boolean(
    useChatStore((s) => (isDirect ? s.hasMoreByPeer[directKey] : s.hasMoreByProject[projectId]))
  );
  const loading = Boolean(
    useChatStore((s) => (isDirect ? s.loadingByPeer[directKey] : s.loadingMessages[projectId]))
  );

  const conversation = useChatStore((s) =>
    isDirect ? undefined : s.conversations.find((c) => c.projectId === projectId)
  );
  const settings = useChatStore((s) => s.settings);

  // 动作：按模式选择不同 store 动作
  const openConversation = useChatStore((s) => (isDirect ? s.openPeer : s.openProject));
  const closeConversation = useChatStore((s) => (isDirect ? s.closePeer : s.closeProject));
  const loadMore = useChatStore((s) => (isDirect ? s.loadMoreDirect : s.loadMore));
  const reloadMessages = useChatStore((s) => s.reloadMessages);
  const sendMessage = useChatStore((s) => (isDirect ? s.sendDirect : s.sendMessage));
  const recallMessage = useChatStore((s) => (isDirect ? s.recallDirect : s.recallMessage));
  const setSetting = useChatStore((s) => s.setSetting);

  // 单聊对方详情（来自成员库，实时取姓名/头像色）
  const peer = useMemberStore((s) => (isDirect ? s.members.find((m) => m.id === peerId) : undefined));
  const peerName = peer?.name || '成员';
  const peerColor = peer?.avatarColor || '#6366F1';

  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [pendingMentions, setPendingMentions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null); // null=不显示下拉
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [newHint, setNewHint] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const atBottomRef = useRef(true);
  const prevLenRef = useRef(0);

  // 群成员：owner + manager + projectIds 命中 + 任务 assignee（仅 project 模式）
  const chatMembers = useMemo(() => {
    if (isDirect) return [];
    const ids = new Set();
    if (project) {
      if (project.ownerId) ids.add(String(project.ownerId));
      if (project.manager) ids.add(String(project.manager));
    }
    (allMembers || []).forEach((m) => {
      if (Array.isArray(m.projectIds) && m.projectIds.includes(projectId)) ids.add(String(m.id));
    });
    (allTasks || []).forEach((t) => {
      if ((t.projectId || t.project_id) !== projectId) return;
      if (Array.isArray(t.assignees)) t.assignees.forEach((a) => { if (a) ids.add(String(a)); });
      else if (t.assignee) ids.add(String(t.assignee));
    });
    // 兜底：store 无项目时用会话的 memberIds
    if (ids.size === 0 && conversation && Array.isArray(conversation.memberIds)) {
      conversation.memberIds.forEach((id) => ids.add(String(id)));
    }
    return [...ids].map((id) => allMembers.find((m) => m.id === id)).filter(Boolean);
  }, [isDirect, project, allMembers, allTasks, projectId, conversation]);

  const memberCount = isDirect ? 2 : (chatMembers.length || conversation?.memberCount || 0);
  const directProjName = isDirect ? (project?.name || (peerProjectId ? `项目${peerProjectId}` : null)) : null;
  const groupTitle = isDirect
    ? (directProjName ? `${peerName} · ${directProjName}` : `${peerName} · 单聊`)
    : (project
        ? `${project.code ? `${project.code} · ` : ''}${project.name}`
        : (conversation?.projectName || '项目群聊'));
  const groupColor = isDirect ? peerColor : (project?.color || conversation?.projectColor || '#6366F1');

  // 进入 / 离开会话（direct 模式带项目维度 peerProjectId）
  useEffect(() => {
    if (isDirect) {
      if (!peerId) return undefined;
      openConversation(peerId, peerProjectId);
      return () => closeConversation();
    }
    if (!projectId) return undefined;
    openConversation(projectId);
    return () => closeConversation();
  }, [isDirect, projectId, peerId, peerProjectId, openConversation, closeConversation]);

  // 首次加载 / 消息变化时滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const len = messages.length;
    if (prevLenRef.current === 0 && len > 0) {
      // 首屏直接落底
      bottomRef.current?.scrollIntoView({ block: 'end' });
      setNewHint(0);
    } else if (len > prevLenRef.current) {
      if (atBottomRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        setNewHint(0);
      } else {
        setNewHint((n) => n + 1);
      }
    }
    prevLenRef.current = len;
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottomRef.current && newHint > 0) setNewHint(0);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setNewHint(0);
  };

  // textarea 自适应高度（1~5 行）
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const max = lineHeight * 5 + 16;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, []);

  useEffect(() => { adjustTextarea(); }, [input, adjustTextarea]);

  // 关闭设置下拉：点击空白处
  useEffect(() => {
    if (!showSettings) return undefined;
    const onClick = () => setShowSettings(false);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [showSettings]);

  // 提及候选（仅 project 模式；单聊无需 @）
  const mentionCandidates = useMemo(() => {
    if (isDirect || mentionQuery === null) return [];
    const q = mentionQuery;
    return chatMembers.filter(
      (m) => m.id !== currentUserId && (!q || pinyinMatch(m.name || '', q))
    );
  }, [isDirect, mentionQuery, chatMembers, currentUserId]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    // 单聊模式不触发 @ 提及下拉
    if (isDirect) { setMentionQuery(null); return; }
    // 检测末尾 @查询：最后一个 @ 之后无空格
    const m = value.match(/@([^\s@]{0,20})$/);
    if (m) {
      setMentionQuery(m[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const applyMention = (member) => {
    if (!member) return;
    const value = input.replace(/@([^\s@]{0,20})$/, `@${member.name} `);
    setInput(value);
    setPendingMentions((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const doSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      if (isDirect) {
        // 单聊发送带项目维度（在哪个项目下）
        // 注意：direct 模式下 sendMessage 即 sendDirect，签名 (peerId, content, replyTo, projectId)
        await sendMessage(peerId, content, replyTo, peerProjectId);
      } else {
        // 仅保留仍存在的成员 id
        const validIds = new Set(chatMembers.map((m) => m.id));
        const mentions = pendingMentions.filter((id) => validIds.has(id));
        await sendMessage(projectId, content, mentions, replyTo);
      }
      setInput('');
      setReplyTo(null);
      setPendingMentions([]);
      setMentionQuery(null);
      atBottomRef.current = true;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0);
    } catch (err) {
      setError(err.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    // 提及下拉打开时用方向键 / Enter 选择（仅 project 模式）
    if (!isDirect && mentionQuery !== null && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionCandidates.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyMention(mentionCandidates[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
    }
    // Enter 发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  const handleMentionClick = (uid) => {
    const m = allMembers.find((x) => x.id === uid);
    if (m) {
      // 预填输入框为提及该成员，便于快速发问
      setInput((v) => `${v}@${m.name} `);
      setPendingMentions((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
      textareaRef.current?.focus();
    }
  };

  const handleRecall = async (msg) => {
    if (!window.confirm('确定撤回这条消息吗？')) return;
    try {
      await recallMessage(msg.id);
    } catch (err) {
      window.alert(`撤回失败：${err.message || '未知错误'}`);
    }
  };

  const handleRefresh = () => {
    if (isDirect) {
      // 单聊重新对齐（带项目维度）
      openConversation(peerId, peerProjectId);
    } else {
      reloadMessages(projectId);
    }
  };

  const grouped = useMemo(() => buildGroups(messages), [messages]);

  return (
    <div
      className={cn('flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden', className)}
      style={{ height: height || '100%' }}
    >
      {/* 头部 */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
            style={{ backgroundColor: groupColor }}
          >
            {isDirect ? (peerName.charAt(0)) : (<Users className="w-4 h-4" />)}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{groupTitle}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {isDirect ? (
                <span className="text-xs text-slate-400">单聊 · 仅双方可见</span>
              ) : (
                <>
                  <span className="text-xs text-slate-400">{memberCount} 名成员</span>
                  {/* 成员头像堆叠 */}
                  <div className="flex -space-x-1.5">
                    {chatMembers.slice(0, MAX_AVATARS).map((m) => (
                      <span
                        key={m.id}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-white"
                        style={{ backgroundColor: m.avatarColor || '#6b7280' }}
                        title={m.name}
                      >
                        {(m.name || '?').charAt(0)}
                      </span>
                    ))}
                    {chatMembers.length > MAX_AVATARS ? (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-200 text-slate-500 text-[9px] font-bold ring-2 ring-white">
                        {`+${chatMembers.length - MAX_AVATARS}`}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-smooth"
            title="刷新消息"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowSettings((v) => !v); }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-smooth"
              title="提醒设置"
            >
              <Settings className="w-4 h-4" />
            </button>
            {showSettings ? (
              <div
                className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setSetting('sound', !settings.sound)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm text-slate-600 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    {settings.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    音效提示
                  </span>
                  <span className={cn('text-xs', settings.sound ? 'text-primary-600' : 'text-slate-400')}>
                    {settings.sound ? '开' : '关'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSetting('desktop', !settings.desktop)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm text-slate-600 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    {settings.desktop ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    桌面通知
                  </span>
                  <span className={cn('text-xs', settings.desktop ? 'text-primary-600' : 'text-slate-400')}>
                    {settings.desktop ? '开' : '关'}
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 消息区 */}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto py-3">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载消息中…
            </div>
          ) : messages.length === 0 ? (
            <EmptyState title="还没有消息" description={isDirect ? '发起与对方的私聊吧' : '发一条消息，开启这个项目的讨论吧'} />
          ) : (
            <>
              {hasMore ? (
                <div className="flex justify-center mb-2">
                  <button
                    type="button"
                    onClick={() => loadMore(isDirect ? peerId : projectId, isDirect ? peerProjectId : undefined)}
                    disabled={loading}
                    className="text-xs text-primary-600 hover:text-primary-700 px-3 py-1 rounded-full bg-white border border-slate-200 disabled:opacity-50"
                  >
                    {loading ? '加载中…' : '加载更早的消息'}
                  </button>
                </div>
              ) : null}

              <div className="space-y-2.5">
                {grouped.map((g) => (
                  <MessageBubble
                    key={g.message.id}
                    message={g.message}
                    isMine={g.message.senderId === currentUserId}
                    showSender={g.showSender}
                    showTime={g.showTime}
                    members={isDirect ? (peer ? [peer] : []) : chatMembers}
                    onReply={(m) => setReplyTo(m)}
                    onRecall={handleRecall}
                    onMentionClick={handleMentionClick}
                  />
                ))}
              </div>
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 新消息提示 */}
        {newHint > 0 ? (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 right-4 flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-500 text-white text-xs shadow-lg hover:bg-primary-600 transition-smooth"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            有新消息
          </button>
        ) : null}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5">
        {/* 引用条 */}
        {replyTo ? (
          <div className="flex items-start gap-2 mb-2 px-2 py-1.5 rounded-lg bg-slate-50 border-l-2 border-primary-400">
            <div className="flex-1 min-w-0 text-xs">
              <span className="text-slate-500">
                回复 <span className="font-medium text-slate-700">{replyTo.senderName}</span>
              </span>
              <p className="text-slate-400 truncate">{replyTo.content || '原消息已撤回'}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-slate-400 hover:text-slate-600 text-sm leading-none px-1"
              title="取消引用"
            >
              ×
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-red-500">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        ) : null}

        <div className="relative">
          {/* 提及下拉（仅 project 模式） */}
          {!isDirect && mentionQuery !== null && mentionCandidates.length > 0 ? (
            <div className="absolute bottom-full mb-1 left-0 w-56 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-20">
              {mentionCandidates.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); applyMention(m); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                    i === mentionIndex ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: m.avatarColor || '#6b7280' }}
                  >
                    {(m.name || '?').charAt(0)}
                  </span>
                  {m.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={isDirect ? '发送私聊消息，Enter 发送，Shift+Enter 换行' : '输入消息，Enter 发送，Shift+Enter 换行'}
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 leading-5 max-h-[116px] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
            <button
              type="button"
              onClick={doSend}
              disabled={!input.trim() || sending}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-smooth"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
