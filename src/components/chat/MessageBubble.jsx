/**
 * MessageBubble - 单条消息气泡
 *
 * Props:
 *   message       {object}  消息对象
 *   isMine        {boolean} 是否为当前用户发送（群聊按 senderId / 单聊按 fromId 归一化，见 messageSenderId）
 *   showSender    {boolean} 保留签名（仅对 !isMine 恒为 true：非本人消息永远显示头像与姓名）
 *   members       {array}   群成员 [{ id, name, avatarColor }]
 *   onReply       {fn}      (message) => void 引用回复
 *   onMentionClick{fn}      (userId) => void 点击 @某某
 *   onRecall      {fn}      (message) => void 撤回本条（自己的消息）
 *   showTime      {boolean} 是否显示时间（默认 true）
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { CornerUpLeft, Trash2, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const DEFAULT_AVATAR = '#6b7280';

/**
 * 归一化消息发送者 id：群聊消息字段为 senderId，单聊消息字段为 fromId。
 *
 * 历史缺陷（需求 1 根因）：单聊消息对象只有 fromId/toId、没有 senderId，
 * 而 ChatWindow 用 `message.senderId === currentUserId` 判定 isMine，
 * 导致单聊里「所有消息」都被判为他人消息、一律渲染在左侧（自己的消息也不在右侧）。
 * 这里统一取值口径，群聊 / 单聊通用。
 * @param {object} message
 * @returns {string|null}
 */
export function messageSenderId(message) {
  if (!message) return null;
  if (message.senderId != null && message.senderId !== '') return String(message.senderId);
  if (message.fromId != null && message.fromId !== '') return String(message.fromId);
  return null;
}

/** 时间显示：HH:mm */
function timeLabel(iso) {
  try {
    return format(new Date(iso), 'HH:mm');
  } catch {
    return '';
  }
}

/** 完整时间（title 悬浮提示） */
function fullTimeLabel(iso) {
  try {
    return format(new Date(iso), 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return '';
  }
}

/**
 * 单张附件图片：懒加载 + 加载失败占位；点击打开 lightbox。
 * @param {{att:object, single:boolean, onOpen:function}} props
 */
function AttachImage({ att, single, onOpen }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 text-slate-400',
          single ? 'w-32 h-32' : 'w-full aspect-square'
        )}
      >
        <ImageOff className="w-5 h-5" />
        <span className="text-[10px]">加载失败</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(att)}
      title={att.name || '图片'}
      className={cn(
        'block overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-white/60',
        single ? '' : 'w-full'
      )}
    >
      <img
        src={att.url}
        alt={att.name || '图片'}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('block object-cover', single ? 'max-h-[220px] max-w-full' : 'w-full aspect-square')}
      />
    </button>
  );
}

export default function MessageBubble({
  message,
  isMine,
  showSender = true,
  members = [],
  onReply,
  onMentionClick,
  onRecall,
  showTime = true,
}) {
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const [hovered, setHovered] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // ESC 关闭 lightbox（仅在打开时挂监听，避免每条消息都注册全局监听）
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (!message) return null;

  // 发送者 id 归一化：群聊 senderId / 单聊 fromId
  const senderId = messageSenderId(message);
  // isMine 以 prop 为准，且「senderId 命中当前用户」时兜底为真，确保自己的消息一定在右侧
  const mine = Boolean(isMine) || (senderId != null && String(senderId) === String(currentUserId));

  const sender = members.find((m) => String(m.id) === senderId) || null;
  const avatarColor = sender?.avatarColor || DEFAULT_AVATAR;
  const senderName = message.senderName || sender?.name || '成员';
  const mentionedMe = Array.isArray(message.mentions) && message.mentions.includes(currentUserId);

  // 需求 3 加固：非本人消息永远显示头像与姓名（不再因连续分组隐藏）。
  // showSender prop 保留签名，但仅对 !isMine 时恒为 true。
  const showSenderName = mine ? false : true;

  const attachments = !message.recalled && Array.isArray(message.attachments) ? message.attachments : [];
  const hasText = String(message.content || '').trim().length > 0;

  // 姓名 -> id 映射，用于把文本中的 @某某 关联到成员
  const nameToId = new Map();
  members.forEach((m) => { if (m && m.name) nameToId.set(m.name, m.id); });

  const renderContent = (text) => {
    // 按 @提及 分词；正则与设计文档一致
    const parts = String(text || '').split(/(@[^\s@]{1,20})/g);
    return parts.map((part, i) => {
      if (part.startsWith('@') && part.length > 1) {
        const name = part.slice(1);
        const uid = nameToId.get(name);
        if (uid) {
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onMentionClick && onMentionClick(uid)}
              onKeyDown={(e) => { if (e.key === 'Enter' && onMentionClick) onMentionClick(uid); }}
              className={cn(
                'cursor-pointer font-medium',
                mine ? 'text-white underline underline-offset-2' : 'text-primary-600'
              )}
            >
              {part}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      className={cn('flex gap-2 px-3', mine ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 头像：他人消息恒显（需求 3 加固） */}
      {!mine ? (
        <div className="w-8 shrink-0 flex flex-col items-center">
          {showSenderName ? (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: avatarColor }}
            >
              {senderName.charAt(0)}
            </span>
          ) : (
            <span className="w-8 h-8" />
          )}
        </div>
      ) : null}

      {/* 气泡主体 */}
      <div className={cn('flex flex-col max-w-[72%]', mine ? 'items-end' : 'items-start')}>
        {!mine && showSenderName ? (
          <span className="text-xs text-slate-400 mb-0.5 px-1">{senderName}</span>
        ) : null}

        <div className={cn('flex items-center gap-1.5', mine ? 'flex-row' : 'flex-row-reverse')}>
          {/* 悬停操作区 */}
          {hovered && !message.recalled ? (
            <div className="flex items-center gap-0.5">
              {onReply ? (
                <button
                  type="button"
                  onClick={() => onReply(message)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-smooth"
                  title="引用回复"
                >
                  <CornerUpLeft className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              'relative rounded-xl px-3 py-2 text-sm break-words',
              message.recalled
                ? 'bg-slate-100 text-slate-400 italic'
                : mine
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-slate-200 text-slate-700',
              // @我 时左侧橙色竖线标识
              mentionedMe && !mine ? 'border-l-2 border-l-amber-400' : ''
            )}
            title={fullTimeLabel(message.createdAt)}
          >
            {/* 引用条 */}
            {message.replyTo && !message.recalled ? (
              <div
                className={cn(
                  'mb-1.5 pl-2 border-l-2 text-xs rounded',
                  mine ? 'border-white/60 text-white/80' : 'border-slate-300 text-slate-500'
                )}
              >
                <span className="font-medium">{message.replyTo.senderName}</span>
                <p className="truncate max-w-[220px]">{message.replyTo.content || '原消息已撤回'}</p>
              </div>
            ) : null}

            {/* 图片附件（撤回消息不渲染） */}
            {attachments.length > 0 ? (
              <div
                className={cn(
                  'mb-1',
                  attachments.length === 1
                    ? 'flex'
                    : 'grid grid-cols-3 gap-1 w-[240px] max-w-full'
                )}
              >
                {attachments.map((att) => (
                  <AttachImage
                    key={att.id || att.url}
                    att={att}
                    single={attachments.length === 1}
                    onOpen={setLightbox}
                  />
                ))}
              </div>
            ) : null}

            {message.recalled ? (
              <span>消息已撤回</span>
            ) : hasText ? (
              <span className="whitespace-pre-wrap break-words">{renderContent(message.content)}</span>
            ) : null}
          </div>

          {/* 撤回按钮：自己的消息悬停显示 */}
          {hovered && mine && !message.recalled && onRecall ? (
            <button
              type="button"
              onClick={() => onRecall(message)}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-smooth"
              title="撤回"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {/* 时间：同一分钟内连续消息由上层仅在末条显示 */}
        {showTime ? (
          <span className="text-[10px] text-slate-400 mt-0.5 px-1">{timeLabel(message.createdAt)}</span>
        ) : null}
      </div>

      {/* 轻量 lightbox：遮罩 + 点击 / ESC 关闭（不引入新依赖）
          通过 portal 挂到 body，避免被祖先 overflow-hidden / transform 裁剪 */}
      {lightbox
        ? createPortal(
            (
              <div
                className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4"
                onClick={() => setLightbox(null)}
                role="dialog"
                aria-modal="true"
              >
                <img
                  src={lightbox.url}
                  alt={lightbox.name || '图片'}
                  className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ),
            document.body
          )
        : null}
    </div>
  );
}
