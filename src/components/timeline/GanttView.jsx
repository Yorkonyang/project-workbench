import { useMemo } from 'react';
import { format, addDays, isSameDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

export default function GanttView({ tasks, milestones, projects }) {
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

  // Group by project
  const groupByProject = useMemo(() => {
    const groups = {};
    allItems.forEach((item) => {
      if (!groups[item.projectId]) groups[item.projectId] = [];
      groups[item.projectId].push(item);
    });
    return Object.entries(groups);
  }, [allItems]);

  const todayPosition = getPosition(todayISO);

  // Project color theme mapping (cycles through themes)
  const projectThemeColors = [
    { nameBg: 'bg-slate-400', nameText: 'text-white', rowEven: 'bg-white', rowOdd: 'bg-slate-50', accent: 'border-slate-200' },
    { nameBg: 'bg-emerald-500', nameText: 'text-white', rowEven: 'bg-white', rowOdd: 'bg-emerald-50', accent: 'border-emerald-200' },
    { nameBg: 'bg-blue-500', nameText: 'text-white', rowEven: 'bg-white', rowOdd: 'bg-blue-50', accent: 'border-blue-200' },
    { nameBg: 'bg-amber-500', nameText: 'text-white', rowEven: 'bg-white', rowOdd: 'bg-amber-50', accent: 'border-amber-200' },
  ];

  const getProjectTheme = (projectIdx) => projectThemeColors[projectIdx % projectThemeColors.length];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 text-sm">项目甘特图</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-12 h-1 bg-blue-400 rounded"></span>
            <span className="text-slate-500">计划时间</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-12 h-1 bg-green-500 rounded"></span>
            <span className="text-slate-500">实际进度</span>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="overflow-x-auto">
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
                  const planLeft = getPosition(item.startDate);
                  const planWidth = getDuration(item.startDate, item.dueDate);
                  const actualStart = item.actualStartDate || item.startDate;
                  // Use latest progress report date as actual end
                  let actualEnd = item.actualEndDate;
                  if (!actualEnd && item.progressReports && item.progressReports.length > 0) {
                    const sortedReports = [...item.progressReports].sort((a, b) =>
                      new Date(b.date) - new Date(a.date)
                    );
                    actualEnd = sortedReports[0]?.date || todayISO;
                  } else if (!actualEnd && (item.status === 'in_progress' || item.status === 'review')) {
                    actualEnd = todayISO;
                  }
                  const actualLeft = getPosition(actualStart);
                  const actualWidth = actualEnd ? getDuration(actualStart, actualEnd) : 0;

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
                          <p className="text-xs font-medium text-slate-700 truncate">
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

                        {/* Plan Bar (Light Blue) - centered in row */}
                        <div
                          className="absolute"
                          style={{
                            left: planLeft,
                            top: '30%',
                            width: Math.max(planWidth, 4),
                            height: 2,
                          }}
                        >
                          <div className="h-full bg-blue-400 rounded opacity-70" />
                        </div>

                        {/* Actual Progress Bar (Green) - only show if task has started */}
                        {(item.status === 'in_progress' || item.status === 'review' || item.status === 'done') && actualWidth > 0 ? (
                          <div
                            className="absolute"
                            style={{
                              left: actualLeft,
                              top: '60%',
                              width: Math.max(actualWidth, 4),
                              height: 2,
                            }}
                          >
                            {/* Progress line with rounded left */}
                            <div className="h-full bg-green-500 rounded-l" />
                            {/* End triangle */}
                            <div
                              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2"
                              style={{
                                width: 0,
                                height: 0,
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                                borderBottom: '7px solid #22c55e',
                              }}
                            />
                          </div>
                        ) : null}

                        {/* Start triangle - only if task has been started */}
                        {(item.status === 'in_progress' || item.status === 'review' || item.status === 'done') && actualLeft > planLeft ? (
                          <div
                            className="absolute"
                            style={{
                              left: actualLeft - 4,
                              top: '56%',
                              width: 0,
                              height: 0,
                              borderLeft: '5px solid transparent',
                              borderRight: '5px solid transparent',
                              borderTop: '7px solid #22c55e',
                            }}
                          />
                        ) : null}
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
