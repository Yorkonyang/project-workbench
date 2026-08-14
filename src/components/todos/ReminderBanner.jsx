import { AlertCircle, Clock, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReminderBanner({ todoDueToday, todoDueTomorrow, todoOverdue, taskDueToday, taskDueTomorrow, taskOverdue }) {
  // 如果所有数据都为空，返回 null
  if (
    todoDueToday.length === 0 && todoDueTomorrow.length === 0 && todoOverdue.length === 0 &&
    taskDueToday.length === 0 && taskDueTomorrow.length === 0 && taskOverdue.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {/* 待办逾期 */}
      {todoOverdue.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-red-700">{todoOverdue.length} 项待办已逾期</span>
            <span className="text-xs text-red-500 ml-2">请尽快处理</span>
          </div>
        </div>
      )}
      {/* 待办今日到期 */}
      {todoDueToday.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Clock className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-amber-700">{todoDueToday.length} 项待办今日到期</span>
          </div>
        </div>
      )}
      {/* 待办明日到期 */}
      {todoDueTomorrow.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <CalendarClock className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-blue-700">{todoDueTomorrow.length} 项待办明日到期</span>
          </div>
        </div>
      )}
      {/* 任务逾期 */}
      {taskOverdue.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-red-700">{taskOverdue.length} 项任务已逾期</span>
            <span className="text-xs text-red-500 ml-2">请尽快处理</span>
          </div>
        </div>
      )}
      {/* 任务今日到期 */}
      {taskDueToday.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Clock className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-amber-700">{taskDueToday.length} 项任务今日到期</span>
          </div>
        </div>
      )}
      {/* 任务明日到期 */}
      {taskDueTomorrow.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <CalendarClock className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-blue-700">{taskDueTomorrow.length} 项任务明日到期</span>
          </div>
        </div>
      )}
    </div>
  );
}
