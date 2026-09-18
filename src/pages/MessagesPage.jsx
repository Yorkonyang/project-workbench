/**
 * MessagesPage - 项目群聊 / 单聊（微信式两栏）
 * 左侧为树形二级菜单：项目行（chevron 展开/收起 + 主体打开群聊），
 * 展开区显示项目成员卡片（点击打开与成员的单聊）。
 * 支持 URL 参数 ?project=<id> 直接定位群聊，?peer=<id> 直接定位单聊。
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { Search, MessageSquare, ArrowLeft, Loader2, ChevronRight, User, History } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import EmptyState from '@/components/ui/EmptyState';
import ChatWindow from '@/components/chat/ChatWindow';
import { cn } from '@/lib/utils';
import { pinyinMatch } from '@/lib/pinyinMatch';
import { useChatStore, peerKey } from '@/store/useChatStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useAuthStore } from '@/store/useAuthStore';

/** 会话列表时间：今天显示 HH:mm，否则 MM-dd */
function convTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return isToday(d) ? format(d, 'HH:mm') : format(d, 'MM-dd');
  } catch {
    return '';
  }
}

/** 未读角标文案：>99 显示 99+ */
function badgeText(n) {
  return n > 99 ? '99+' : String(n);
}

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({}); // projectId -> boolean

  const conversations = useChatStore((s) => s.conversations);
  const loading = useChatStore((s) => s.conversationsLoading);
  const error = useChatStore((s) => s.conversationsError);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const activePeerId = useChatStore((s) => s.activePeerId);
  const activePeerProjectId = useChatStore((s) => s.activePeerProjectId);
  const unreadByProject = useChatStore((s) => s.unreadByProject);
  const unreadByProjectDirect = useChatStore((s) => s.unreadByProjectDirect);
  const orphanDirectUnread = useChatStore((s) => s.orphanDirectUnread);
  const unreadByPeer = useChatStore((s) => s.unreadByPeer);
  const directConversations = useChatStore((s) => s.directConversations);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const fetchUnread = useChatStore((s) => s.fetchUnread);
  const fetchDirectConversations = useChatStore((s) => s.fetchDirectConversations);
  const openProject = useChatStore((s) => s.openProject);
  const closeProject = useChatStore((s) => s.closeProject);
  const openPeer = useChatStore((s) => s.openPeer);
  const closePeer = useChatStore((s) => s.closePeer);

  const allMembers = useMemberStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.currentUserId) || '';

  // 首次进入：拉会话与未读
  useEffect(() => {
    fetchConversations();
    fetchUnread();
    fetchDirectConversations();
  }, [fetchConversations, fetchUnread, fetchDirectConversations]);

  // URL 参数定位会话（?peer= 单聊优先带 ?project= 项目维度；?project= 定位群聊）
  // 兼容：升级前的旧通知链接只有 ?peer=xxx，此时从已加载的单聊会话回填该项目维度，
  // 否则单聊发送会因缺少 projectId 被后端拒绝（400「缺少 projectId」）。
  useEffect(() => {
    const pid = searchParams.get('project');
    const peer = searchParams.get('peer');
    if (peer) {
      const isSamePeer = String(activePeerId || '') === String(peer);
      // 已打开同一会话 → 不重复打开
      if (isSamePeer && peerKey(peer, pid) === peerKey(activePeerId, activePeerProjectId)) return;
      // 同一 peer 且 URL 未指定项目：保持当前维度，避免会话列表刷新导致跳项目
      if (isSamePeer && !pid) return;

      let resolved = pid;
      if (!resolved) {
        const cand = (directConversations || [])
          .filter((c) => String(c.peerId) === String(peer) && c.projectId)
          .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
        resolved = cand.length ? cand[0].projectId : null;
      }
      openPeer(peer, resolved);
    } else if (pid && pid !== activeProjectId) {
      openProject(pid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, directConversations]);

  // 单聊未读快照：`${peerId}#${projectId}` -> unreadCount（复合 key，合并会话列表与 byPeer）
  const directUnreadMap = useMemo(() => {
    const map = {};
    // 自己不是"对方"：显式排除 currentUserId 名下，杜绝"自己发给自己的消息"计为未读
    const selfKey = currentUserId ? String(currentUserId) : '';
    (directConversations || []).forEach((c) => {
      if (!c.peerId || String(c.peerId) === selfKey) return;
      const k = peerKey(c.peerId, c.projectId);
      map[k] = (map[k] || 0) + (c.unreadCount || 0);
    });
    // byPeer（后端实时未读，已按复合 key）优先覆盖
    Object.keys(unreadByPeer || {}).forEach((k) => {
      const peerPart = k.split('#')[0];
      if (selfKey && peerPart === selfKey) return;
      map[k] = unreadByPeer[k] || 0;
    });
    return map;
  }, [directConversations, unreadByPeer, currentUserId]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return conversations;
    return conversations.filter(
      (c) => pinyinMatch(c.projectName || '', q) || (c.projectCode || '').toLowerCase().includes(q.toLowerCase())
    );
  }, [conversations, query]);

  const toggleExpand = (pid) => {
    setExpanded((prev) => ({ ...prev, [pid]: !prev[pid] }));
  };

  // projectId=null 桶（旧数据）的单聊会话：为「其他单聊（历史）」入口提供 peer 列表。
  // 合并两个来源：directConversations（含 lastMessage/unread）与 unreadByPeer 里 key 形如 `peerId#` 的项。
  const orphanConversations = useMemo(() => {
    const selfKey = currentUserId ? String(currentUserId) : '';
    const map = {}; // peerId -> { peerId, unread, lastMessageAt }
    (directConversations || []).forEach((c) => {
      if (c.projectId != null) return; // 只要 null 桶
      if (!c.peerId || String(c.peerId) === selfKey) return;
      const prev = map[c.peerId];
      map[c.peerId] = {
        peerId: c.peerId,
        unread: c.unreadCount || 0,
        lastMessageAt: (prev && prev.lastMessageAt) || c.lastMessageAt || null,
      };
    });
    Object.keys(unreadByPeer || {}).forEach((k) => {
      if (!k.endsWith('#')) return; // 只要空 projectId 桶
      const peerId = k.slice(0, -1);
      if (!peerId) return;
      if (selfKey && peerId === selfKey) return;
      const prev = map[peerId] || { peerId, unread: 0, lastMessageAt: null };
      map[peerId] = { ...prev, unread: unreadByPeer[k] || 0 };
    });
    return Object.values(map).sort(
      (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );
  }, [directConversations, unreadByPeer, currentUserId]);

  // 项目成员卡片（过滤掉自己），用于二级菜单
  // 加固：登录态未就绪（currentUserId 为空）时直接返回空列表，不渲染成员卡片，
  // 避免"自己"混入二级菜单（空串/ null 下 String(m.id) !== String(currentUserId) 恒为 true，过滤会失效）。
  // 根治：名单 = 项目派生成员（c.memberIds）∪ 该项目下与我有单聊往来者（c.dmPeers），
  //       保证"有往来必有入口"；非派生成员（仅凭单聊往来进入）打 __directOnly 标记。
  const membersOf = (c) => {
    if (!currentUserId) return [];
    const derived = (c.memberIds || [])
      .map((id) => allMembers.find((m) => m.id === id))
      .filter((m) => m && String(m.id) !== String(currentUserId))
      .map((m) => ({ ...m, __directOnly: false }));
    const seen = new Set(derived.map((m) => String(m.id)));
    const extra = (c.dmPeers || [])
      .filter((id) => id && String(id) !== String(currentUserId) && !seen.has(String(id)))
      .map((id) => allMembers.find((m) => m.id === id))
      .filter((m) => m)
      .map((m) => ({ ...m, __directOnly: true }));
    return [...derived, ...extra];
  };

  const handleSelectProject = (pid) => {
    openProject(pid);
    closePeer();
    setSearchParams({ project: pid });
  };

  // 单聊选中：传入项目维度 pid（"在哪个项目下"），URL 同时带 ?peer= 与 ?project=
  const handleSelectPeer = (pid, peerId) => {
    openPeer(peerId, pid);
    closeProject();
    setSearchParams({ peer: peerId, project: pid });
  };

  // 历史（无项目归属）单聊选中：projectId=null 桶，URL 只带 ?peer=
  const handleSelectOrphan = (peerId) => {
    openPeer(peerId, null);
    closeProject();
    setSearchParams({ peer: peerId });
  };

  const handleBack = () => {
    closeProject();
    closePeer();
    setSearchParams({});
  };

  const chatMode = activePeerId ? 'direct' : 'project';
  // 单聊模式下也带项目维度：chatProjectId 在 direct 模式下 = 当前单聊所在项目
  const chatProjectId = activePeerId ? activePeerProjectId : activeProjectId;

  return (
    <PageContainer>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-primary-500" />
        <h2 className="text-xl font-bold text-slate-800">项目群聊</h2>
        <span className="text-sm text-slate-400">按项目分群的即时沟通，可发起单聊</span>
      </div>

      <div className="h-[calc(100vh-11rem)] min-h-[420px] flex rounded-xl overflow-hidden">
        {/* 左栏：会话列表（树形二级菜单） */}
        <div
          className={cn(
            'w-full lg:w-72 shrink-0 flex-col bg-white border border-slate-200 rounded-xl lg:rounded-r-none lg:border-r-0',
            (activeProjectId || activePeerId) ? 'hidden lg:flex' : 'flex'
          )}
        >
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索项目名称 / 编号"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> 加载会话中…
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-red-500">{error}</div>
            ) : filtered.length === 0 && orphanConversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">暂无可参与的群聊</div>
            ) : (
              <>
              {filtered.map((c) => {
                // 项目行红点 = 群聊未读 + 该项目单聊未读（语义 = 点开后能看到的消息数）
                const unread =
                  (unreadByProject[c.projectId] || 0) + (unreadByProjectDirect[c.projectId] || 0);
                const isActiveProject = c.projectId === activeProjectId && !activePeerId;
                const isExpanded = Boolean(expanded[c.projectId]);
                const members = membersOf(c);
                return (
                  <div key={c.projectId} className="border-b border-slate-50">
                    {/* 项目行：chevron + 主体（点击打开群聊） */}
                    <div
                      className={cn(
                        'flex items-stretch',
                        isActiveProject ? 'bg-primary-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(c.projectId)}
                        className="flex items-center justify-center w-8 shrink-0 text-slate-400 hover:text-slate-600"
                        title={isExpanded ? '收起成员' : '展开成员'}
                      >
                        <ChevronRight
                          className={cn('w-4 h-4 transition-transform', isExpanded ? 'rotate-90' : '')}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectProject(c.projectId)}
                        className="flex-1 flex items-center gap-3 px-2 py-3 text-left"
                      >
                        <span
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
                          style={{ backgroundColor: c.projectColor || '#6366F1' }}
                        >
                          {(c.projectName || '?').charAt(0)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800 truncate">
                              {c.projectName}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {convTime(c.lastMessageAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 truncate">{previewTextOf(c)}</span>
                            {unread > 0 ? (
                              <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                                {badgeText(unread)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* 展开区：成员卡片（点击打开单聊） */}
                    {isExpanded ? (
                      <div className="bg-slate-50/60 max-h-60 overflow-y-auto">
                        {members.length === 0 ? (
                          <div className="px-4 py-2 text-xs text-slate-400">暂无其他成员</div>
                        ) : (
                          members.map((m) => {
                            const pu = directUnreadMap[peerKey(m.id, c.projectId)] || 0;
                            const isActivePeer =
                              activePeerId === m.id && activePeerProjectId === c.projectId;
                            return (
                              <button
                                key={peerKey(m.id, c.projectId)}
                                type="button"
                                onClick={() => handleSelectPeer(c.projectId, m.id)}
                                className={cn(
                                  'w-full flex items-center gap-2.5 pl-10 pr-3 py-2 text-left',
                                  isActivePeer ? 'bg-primary-50' : 'hover:bg-white'
                                )}
                              >
                                <span
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                                  style={{ backgroundColor: m.avatarColor || '#6b7280' }}
                                >
                                  {(m.name || '?').charAt(0)}
                                </span>
                                <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                                  {m.name}
                                </span>
                                {m.__directOnly ? (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] leading-none bg-slate-200 text-slate-500">
                                    单聊
                                  </span>
                                ) : null}
                                {pu > 0 ? (
                                  <span className="shrink-0 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                                    {badgeText(pu)}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {/* 「其他单聊（历史）」入口：projectId=null 桶（旧数据）的兜底入口，消灭最后一种死红点 */}
              {orphanConversations.length > 0 ? (
                <div className="border-b border-slate-50">
                  <div className="flex items-stretch hover:bg-slate-50">
                    <button
                      type="button"
                      onClick={() => toggleExpand('__orphan__')}
                      className="flex items-center justify-center w-8 shrink-0 text-slate-400 hover:text-slate-600"
                      title={expanded['__orphan__'] ? '收起' : '展开'}
                    >
                      <ChevronRight
                        className={cn('w-4 h-4 transition-transform', expanded['__orphan__'] ? 'rotate-90' : '')}
                      />
                    </button>
                    <div className="flex-1 flex items-center gap-3 px-2 py-3">
                      <span className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 bg-slate-400">
                        <History className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">其他单聊（历史）</span>
                          {orphanDirectUnread > 0 ? (
                            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                              {badgeText(orphanDirectUnread)}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 truncate">未归属项目的历史消息</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {expanded['__orphan__'] ? (
                    <div className="bg-slate-50/60 max-h-60 overflow-y-auto">
                      {orphanConversations.map((o) => {
                        const m = allMembers.find((x) => x.id === o.peerId);
                        const oUnread = directUnreadMap[peerKey(o.peerId, null)] || o.unread || 0;
                        const isActivePeer =
                          activePeerId === o.peerId && activePeerProjectId === null;
                        const name = m ? m.name : '成员';
                        const color = m ? (m.avatarColor || '#6b7280') : '#6b7280';
                        return (
                          <button
                            key={peerKey(o.peerId, null)}
                            type="button"
                            onClick={() => handleSelectOrphan(o.peerId)}
                            className={cn(
                              'w-full flex items-center gap-2.5 pl-10 pr-3 py-2 text-left',
                              isActivePeer ? 'bg-primary-50' : 'hover:bg-white'
                            )}
                          >
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {name.charAt(0)}
                            </span>
                            <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{name}</span>
                            {oUnread > 0 ? (
                              <span className="shrink-0 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                                {badgeText(oUnread)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
              </>
            )}
          </div>
        </div>

        {/* 右栏：聊天窗口 */}
        <div
          className={cn(
            'flex-1 min-w-0 flex-col',
            (activeProjectId || activePeerId) ? 'flex' : 'hidden lg:flex'
          )}
        >
          {activePeerId || activeProjectId ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* 移动端返回按钮 */}
              <button
                type="button"
                onClick={handleBack}
                className="lg:hidden flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 px-2 py-2"
              >
                <ArrowLeft className="w-4 h-4" /> 返回会话列表
              </button>
              <div className="flex-1 min-h-0">
                <ChatWindow
                  mode={chatMode}
                  projectId={chatProjectId}
                  peerId={activePeerId}
                  peerProjectId={activePeerId ? activePeerProjectId : undefined}
                  height="100%"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white border border-slate-200 rounded-xl lg:rounded-l-none">
              <EmptyState
                icon={MessageSquare}
                title="选择会话"
                description="从左侧选择项目群，或展开项目成员发起单聊"
              />
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

/** 群会话预览文案 */
function previewTextOf(c) {
  const last = c.lastMessage;
  if (!last) return '暂无消息';
  if (last.recalled) return '消息已撤回';
  const hasImage = Array.isArray(last.attachments) && last.attachments.length > 0;
  // 纯图片消息 content 为空串，此处回退为「[图片]」；图文混排显示「[图片] 文字」
  const body = last.content ? (hasImage ? `[图片] ${last.content}` : last.content) : (hasImage ? '[图片]' : '');
  return `${last.senderName || ''}：${body}`;
}
