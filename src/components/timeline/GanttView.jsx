import { useMemo, Fragment, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, isSameDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Flag, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMilestoneDone } from '@/config/theme';
import { buildProjectThemeMap } from '@/lib/projectTheme';

export default function GanttView({ tasks, milestones, projects }) {
  const navigate = useNavigate();
  // Merge tasks and milestones with unified date fields
  // Filter out tasks from archived projects
  const activeProjectIds = new Set(
    (projects || []).filter((p) => !p.archived).map((p) => p.id)
  );
  const filteredTasks = tasks.filter((t) => activeProjectIds.has(t.projectId));
  const filteredMilestones = milestones.filter((m) => activeProjectIds.has(m.projectId));

  const allItems = useMemo(() => {
    const merged = [...filteredTasks];
    filteredMilestones.forEach((m) => {
      merged.push({
        ...m,
        startDate: m.date,
        dueDate: m.date,
        type: 'milestone',
      });
    });
    return merged;
  }, [filteredTasks, filteredMilestones]);

  if (allItems.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        暂无任务数据
      </div>
    );
  }

  const today = new Date();
  const todayISO = format(today, 'yyyy-MM-dd');

  // Determine date range - always month view
  const calculateDateRange = () => {
    const dates = allItems.flatMap((item) => {
      const result = [];
      // 跳过无效日期，防止 parseISO(undefined) 内部 .split() 报错
      if (item.startDate) {
        result.push(parseISO(item.startDate));
      }
      if (item.dueDate) {
        result.push(parseISO(item.dueDate));
      } else {
        result.push(today);
      }
      return result;
    });

    let minDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : today;
    let maxDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : today;

    // Snap to month boundaries
    minDate = startOfMonth(minDate);
    maxDate = endOfMonth(maxDate);

    // Add padding (1 month on each side)
    const startDate = addDays(minDate, -30);
    const endDate = addDays(maxDate, 30);

    return { startDate, endDate };
  };

  const { startDate: chartStartDate, endDate: chartEndDate } = useMemo(calculateDateRange, [allItems]);

  const totalDays = Math.ceil((chartEndDate - chartStartDate) / (1000 * 60 * 60 * 24));
  
  const dayWidth = 45; // Fixed width for month view
  const totalWidth = totalDays * dayWidth;
  const rowHeight = 64; // Height for individual task rows
  const summaryRowHeight = 40; // Height for summary row

  // 进度线视觉常量（相对原 height:2 增粗 5 倍 → 10）
  const LINE_W = 10;                 // 线宽（原 2 的 5 倍）
  const PLAN_TOP = 24;              // 计划线在上（px，距行顶）
  const ACTUAL_TOP = 40;            // 实际线在下（px，距行顶）
  const ACTUAL_CENTER = ACTUAL_TOP + LINE_W / 2; // 实际线纵向中心（圆球/竖线/方块对齐基准）

  // Generate days with proper labels for header
  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = addDays(chartStartDate, i);
      arr.push({
        date: d,
        isToday: isSameDay(d, today),
        month: d.getMonth(),
        year: d.getFullYear(),
      });
    }
    return arr;
  }, [chartStartDate, totalDays, today]);

  // Generate header labels - group by month
  const headerLabels = useMemo(() => {
    const months = [];
    let currentMonth = -1;
    let currentYear = -1;
    let count = 0;

    days.forEach((day) => {
      if (day.month !== currentMonth || day.year !== currentYear) {
        if (count > 0) {
          months.push({ label: `${currentYear}年${currentMonth + 1}月`, start: totalDays - count, count });
        }
        currentMonth = day.month;
        currentYear = day.year;
        count = 1;
      } else {
        count++;
      }
    });
    if (count > 0) {
      months.push({ label: `${currentYear}年${currentMonth + 1}月`, start: totalDays - count, count });
    }
    return months;
  }, [days, totalDays]);

  const getPosition = (dateStr) => {
    if (!dateStr) return 0;
    try {
      const date = parseISO(dateStr);
      const diff = Math.ceil((date - chartStartDate) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff * dayWidth);
    } catch {
      return 0;
    }
  };

  const getDuration = (startStr, endStr) => {
    if (!startStr || !endStr) return dayWidth;
    try {
      const start = parseISO(startStr);
      const end = parseISO(endStr);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(diff * dayWidth, dayWidth);
    } catch {
      return dayWidth;
    }
  };

  // Group by project — 按 code 字典序排序，保证与 TaskCard 进行中列填色完全对应
  const projectThemeMap = useMemo(() => buildProjectThemeMap(projects || []), [projects]);
  const groupByProject = useMemo(() => {
    const groups = {};
    allItems.forEach((item) => {
      if (!groups[item.projectId]) groups[item.projectId] = [];
      groups[item.projectId].push(item);
    });
    // 按项目编号字典序稳定排序
    const sortedEntries = Object.entries(groups).sort(([idA], [idB]) => {
      const codeA = (projects || []).find((p) => p.id === idA)?.code || idA;
      const codeB = (projects || []).find((p) => p.id === idB)?.code || idB;
      return (codeA || '').localeCompare(codeB || '');
    });
    return sortedEntries;
  }, [allItems, projects]);

  const todayPosition = getPosition(todayISO);

  // 打开页面时把“今天”滚动到可视区中央（任务标签列为 w-48 = 192px，需从可视宽度中扣除）
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const LABEL_W = 192;
    const raf = requestAnimationFrame(() => {
      const visibleW = Math.max(0, el.clientWidth - LABEL_W);
      const center = todayPosition + dayWidth / 2 - visibleW / 2;
      const max = el.scrollWidth - el.clientWidth;
      el.scrollTo({ left: Math.max(0, Math.min(center, max)), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [todayPosition, chartStartDate, totalDays, dayWidth]);

  // Project color theme mapping: 使用共享主题表（src/lib/projectTheme.js），与 TaskCard 进行中列底色保持完全一致
  const getProjectTheme = (projectIdx) => {
    const themes = [
      { nameBg: 'bg-slate-400', nameText: 'text-white', rowEven: 'bg-white', rowOdd: 'bg-slate-50', accent: 'border-slate-200' },
      { nameBg: 'bg-emerald-500', nameText: 'text-white', rowEven: 'bg-white', rowOdd: 'bg-emerald-50', accent: 'border-emerald-200' },
      { nameBg: 'bg-blue-500', nameText: 'text-white', rowEven: 'bg-white', rowOdd: 'bg-blue-50', accent: 'border-blue-200' },
      { nameBg: 'bg-amber-500', nameText: 'text-white', rowEven: 'bg-white', rowOdd: 'bg-amber-50', accent: 'border-amber-200' },
    ];
    return themes[projectIdx % themes.length];
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 text-sm">项目甘特图</h3>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-10 h-2.5 bg-blue-400 rounded"></span>
            <span className="text-slate-500">计划时间</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-slate-500">启动点</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-10 h-2.5 bg-green-500 rounded"></span>
            <span className="text-slate-500">实际进度</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-0.5 h-4 bg-green-500"></span>
            <span className="text-slate-500">汇报节点</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-green-500 rounded-sm"></span>
            <span className="text-slate-500">已完成</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-10 h-2.5 bg-red-500 rounded"></span>
            <span className="text-slate-500">超期</span>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="overflow-x-auto gantt-scroll" ref={scrollRef}>
        <div className="min-w-max">
          {/* Date Header - Month labels */}
          <div className="flex border-b border-slate-100 sticky top-0 bg-white z-20">
            <div className="w-48 shrink-0 px-4 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-r border-slate-100 sticky left-0 z-30">
              任务
            </div>
            <div className="flex-1 flex overflow-hidden">
              {headerLabels.map((label, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center text-xs font-medium text-slate-600 border-r border-slate-50"
                  style={{ width: label.count * dayWidth, minWidth: label.count * dayWidth }}
                >
                  {label.label}
                </div>
              ))}
            </div>
          </div>

          {/* Day numbers row */}
          <div className="flex border-b border-slate-50">
            <div className="w-48 shrink-0 bg-slate-50 border-r border-slate-100 sticky left-0 z-10"></div>
            <div className="flex-1 flex overflow-hidden">
              {days.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-center text-[10px] text-slate-400 border-r border-slate-50',
                    day.isToday && 'bg-primary-50 text-primary-600 font-medium'
                  )}
                  style={{ width: dayWidth }}
                >
                  {format(day.date, 'd')}
                </div>
              ))}
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-slate-50">
            {groupByProject.map(([projectId, items], projectIdx) => {
              const theme = getProjectTheme(projectIdx);
              return (
              <div key={projectId}>
                {/* Summary Row */}
                <div
                  className={cn(
                    "flex transition-smooth",
                    theme.nameBg,
                    theme.nameText
                  )}
                  style={{ height: summaryRowHeight }}
                >
                  <div className={cn("w-48 shrink-0 px-4 py-2 border-r flex items-center sticky left-0 z-30", theme.nameBg, "text-white")}>
                    <p className="text-sm font-medium truncate">
                      {(() => {
                        const project = projects?.find((p) => p.id === projectId);
                        return project?.name || projectId;
                      })()}
                    </p>
                  </div>
                  <div className="flex-1 relative" style={{ width: totalWidth, height: summaryRowHeight }}>
                    {/* Grid Lines */}
                    <div className="absolute inset-0 flex">
                      {days.map((day, i) => (
                        <div
                          key={i}
                          className={cn(
                            'border-r h-full',
                            theme.accent,
                            day.isToday && 'bg-red-50'
                          )}
                          style={{ width: dayWidth }}
                        />
                      ))}
                    </div>

                    {/* Today Line - Full Height */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-red-400 opacity-70 z-10"
                      style={{ left: todayPosition + dayWidth / 2 }}
                    />

                    {/* Note: Summary row no longer shows plan bars - removed extra lines */}
                  </div>
                </div>

                {/* Individual Task Rows */}
                {items.map((item, idx) => {
                  const isMilestone = item.type === 'milestone';
                  const planLeft = getPosition(item.startDate);
                  const planWidth = getDuration(item.startDate, item.dueDate);
                  const actualStart = item.actualStartDate || item.startDate;
                  const dueRight = getPosition(item.dueDate) + dayWidth; // 计划线右边界
                  // 任务是否已启动（进行中 / 评审中 / 已完成）
                  const started =
                    actualStart && ['in_progress', 'review', 'done'].includes(item.status);
                  const isDone = item.status === 'done';
                  // 进度汇报按日期升序排列
                  const reportsSorted = (item.progressReports || [])
                    .slice()
                    .sort((a, b) => new Date(a.date) - new Date(b.date));
                  const actualLeft = getPosition(actualStart);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex hover:bg-opacity-80 transition-smooth",
                        (projectIdx + idx) % 2 === 0 ? theme.rowEven : theme.rowOdd
                      )}
                      style={{ height: rowHeight }}
                    >
                      {/* Task Info - sticky left column */}
                      <div className={cn("w-48 shrink-0 px-4 py-2 border-r flex items-center sticky left-0 z-30", theme.rowEven)}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate flex items-center gap-1.5">
                            {item.type === 'milestone' && (
                              <Flag
                                className="w-3.5 h-3.5 shrink-0"
                                style={{
                                  color: isMilestoneDone(item) ? '#10b981' : '#8b5cf6',
                                  fill: isMilestoneDone(item) ? '#10b981' : 'none',
                                  strokeWidth: isMilestoneDone(item) ? 0 : 2,
                                }}
                              />
                            )}
                            {item.title}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {item.startDate}
                            {item.dueDate && item.startDate !== item.dueDate && ` → ${item.dueDate}`}
                          </p>
                        </div>
                      </div>

                      {/* Gantt Area */}
                      <div className="flex-1 relative" style={{ width: totalWidth }}>
                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex">
                          {days.map((day, i) => (
                            <div
                              key={i}
                              className={cn(
                                'border-r h-full',
                                theme.accent,
                                day.isToday && 'bg-red-50'
                              )}
                              style={{ width: dayWidth }}
                            />
                          ))}
                        </div>

                        {/* Today Line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-red-400 opacity-70 z-10"
                          style={{ left: todayPosition + dayWidth / 2 }}
                        />

                        {/* Plan Bar (Light Blue) - 向下增粗 5 倍；里程碑不显示计划线 */}
                        {!isMilestone && (
                          <div
                            className="absolute cursor-pointer hover:opacity-100 transition-opacity"
                            style={{
                              left: planLeft,
                              top: PLAN_TOP,
                              width: Math.max(planWidth, LINE_W),
                              height: LINE_W,
                            }}
                            onClick={() => navigate(`/tasks?taskId=${item.id}`)}
                            title="点击查看任务详情"
                          >
                            <div className="h-full bg-blue-400 rounded opacity-70" />
                          </div>
                        )}

                        {/* 实际进度线（核心逻辑）：仅任务且已启动 */}
                        {!isMilestone && started && (
                          <Fragment>
                            {/* 启动点：绿色实心小圆球（起点通用标识，含已完成任务）*/}
                            <div
                              className="absolute rounded-full bg-green-500 z-20 cursor-pointer hover:scale-110 transition-transform"
                              style={{
                                left: actualLeft - (LINE_W + 2) / 2,
                                top: ACTUAL_CENTER - (LINE_W + 2) / 2,
                                width: LINE_W + 2,
                                height: LINE_W + 2,
                              }}
                              title="任务已启动（起点）- 点击查看任务详情"
                              onClick={() => navigate(`/tasks?taskId=${item.id}`)}
                            />

                            {/* 每次进度汇报：一段线 + 右端竖线（末段且完成 → 绿色实心方块）*/}
                            {reportsSorted.map((rep, i) => {
                              const segLeft =
                                i === 0 ? actualLeft : getPosition(reportsSorted[i - 1].date) + dayWidth;
                              const segRight = getPosition(rep.date) + dayWidth;
                              if (segRight <= segLeft) return null;
                              const isLast = i === reportsSorted.length - 1;
                              const overPlan = segRight > dueRight;
                              const endColor = overPlan ? '#ef4444' : '#22c55e';
                              // 绿色部分（未超出计划线）
                              const greenRight = Math.min(segRight, dueRight);
                              const hasGreen = greenRight > segLeft;
                              // 红色部分（超出计划线）
                              const redLeft = Math.max(segLeft, dueRight);
                              const hasRed = segRight > dueRight && redLeft < segRight;
                              return (
                                <Fragment key={rep.id || i}>
                              {hasGreen && (
                                <div
                                  className="absolute cursor-pointer hover:opacity-100 transition-opacity"
                                  style={{
                                    left: segLeft,
                                    top: ACTUAL_TOP,
                                    width: greenRight - segLeft,
                                    height: LINE_W,
                                    background: '#22c55e',
                                    borderRadius: 2,
                                  }}
                                  onClick={() => navigate(`/tasks?taskId=${item.id}`)}
                                  title="点击查看任务详情"
                                />
                              )}
                              {hasRed && (
                                <div
                                  className="absolute cursor-pointer hover:opacity-100 transition-opacity"
                                  style={{
                                    left: redLeft,
                                    top: ACTUAL_TOP,
                                    width: segRight - redLeft,
                                    height: LINE_W,
                                    background: '#ef4444',
                                    borderRadius: 2,
                                  }}
                                  onClick={() => navigate(`/tasks?taskId=${item.id}`)}
                                  title="点击查看任务详情"
                                />
                              )}
                                  {isLast && isDone ? (
                                    <div
                                      className="absolute bg-green-500 z-20"
                                      style={{
                                        left: segRight - LINE_W,
                                        top: ACTUAL_CENTER - LINE_W,
                                        width: LINE_W * 2,
                                        height: LINE_W * 2,
                                        borderRadius: '50%',
                                      }}
                                      title="任务已完成"
                                    />
                                  ) : (
                                    <div
                                      className="absolute z-20"
                                      style={{
                                        left: segRight - 1.5,
                                        top: ACTUAL_CENTER - (LINE_W * 1.5) / 2,
                                        width: 3,
                                        height: LINE_W * 1.5,
                                        background: endColor,
                                      }}
                                      title={`进度汇报 ${rep.date}`}
                                    />
                                  )}
                                </Fragment>
                              );
                            })}

                            {/* 已完成但无进度汇报：在起点画绿色实心圆 */}
                            {isDone && reportsSorted.length === 0 && (
                              <div
                                className="absolute bg-green-500 z-20"
                                style={{
                                  left: actualLeft - LINE_W,
                                  top: ACTUAL_CENTER - LINE_W,
                                  width: LINE_W * 2,
                                  height: LINE_W * 2,
                                  borderRadius: '50%',
                                }}
                                title="任务已完成"
                              />
                            )}
                          </Fragment>
                        )}

                        {/* 里程碑标记：空心小旗（未完成）/ 实心五角星（完成）*/}
                        {isMilestone && (
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                            style={{
                              left: planLeft + Math.max(planWidth, LINE_W) / 2,
                              top: '50%',
                            }}
                            title={`${isMilestoneDone(item) ? '已完成' : '未完成'}里程碑：${item.title}`}
                          >
                            {isMilestoneDone(item) ? (
                              <Star
                                className="w-5 h-5 drop-shadow"
                                style={{ fill: '#f59e0b', color: '#f59e0b', strokeWidth: 0 }}
                              />
                            ) : (
                              <Flag
                                className="w-4 h-4"
                                style={{ color: '#8b5cf6', fill: 'none', strokeWidth: 2 }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
