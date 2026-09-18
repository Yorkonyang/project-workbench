/**
 * MessageBubble - 单条消息气泡
 *
 * Props:
 *   message       {object}  消息对象
 *   isMine        {boolean} 是否为当前用户发送
 *   showSender    {boolean} 保留签名（仅对 !isMine 恒为 true：非本人消息永远显示头像与姓名，见需求 3 加固）
 *   members       {array}   群成员 [{ id, name, avatarColor }]
 *   onReply       {fn}      (message) => void 引用回复
 *   onMentionClick{fn}      (userId) => void 点击 @某某
 *   onRecall      {fn}      (message) => void 撤回本条（自己的消息）
 *   showTime      {boolean} 是否显示时间（默认 true）
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { CornerUpLeft, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const DEFAULT_AVATAR = '#6b7280';

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

  if (!message) return null;

  const sender = members.find((m) => m.id === message.senderId) || null;
  const avatarColor = sender?.avatarColor || DEFAULT_AVATAR;
  const senderName = message.senderName || sender?.name || '成员';
  const mentionedMe = Array.isArray(message.mentions) && message.mentions.includes(currentUserId);

  // 需求 3 加固：非本人消息永远显示头像与姓名（不再因连续分组隐藏）。
  // showSender prop 保留签名，但仅对 !isMine 时恒为 true。
  const showSenderName = isMine ? false : true;

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
                isMine ? 'text-white underline underline-offset-2' : 'text-primary-600'
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
      className={cn('flex gap-2 px-3', isMine ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 头像：他人消息恒显（需求 3 加固） */}
      {!isMine ? (
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
      <div className={cn('flex flex-col max-w-[72%]', isMine ? 'items-end' : 'items-start')}>
        {!isMine && showSenderName ? (
          <span className="text-xs text-slate-400 mb-0.5 px-1">{senderName}</span>
        ) : null}

        <div className={cn('flex items-center gap-1.5', isMine ? 'flex-row' : 'flex-row-reverse')}>
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
                : isMine
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-slate-200 text-slate-700',
              // @我 时左侧橙色竖线标识
              mentionedMe && !isMine ? 'border-l-2 border-l-amber-400' : ''
            )}
            title={fullTimeLabel(message.createdAt)}
          >
            {/* 引用条 */}
            {message.replyTo && !message.recalled ? (
              <div
                className={cn(
                  'mb-1.5 pl-2 border-l-2 text-xs rounded',
                  isMine ? 'border-white/60 text-white/80' : 'border-slate-300 text-slate-500'
                )}
              >
                <span className="font-medium">{message.replyTo.senderName}</span>
                <p className="truncate max-w-[220px]">{message.replyTo.content || '原消息已撤回'}</p>
              </div>
            ) : null}

            {message.recalled ? (
              <span>消息已撤回</span>
            ) : (
              <span className="whitespace-pre-wrap break-words">{renderContent(message.content)}</span>
            )}
          </div>

          {/* 撤回按钮：自己的消息悬停显示 */}
          {hovered && isMine && !message.recalled && onRecall ? (
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
    </div>
  );
}
