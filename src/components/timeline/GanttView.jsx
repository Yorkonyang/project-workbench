import { useMemo, Fragment, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, isSameDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Flag, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMilestoneDone } from '@/config/theme';
import { getLevel, getAncestors } from '@/lib/hierarchy';
import { PROJECT_THEMES, getLevelShade, getTaskAltBg } from '@/lib/projectTheme';
import { isOffDay, getDayType, OFF_DAY_BG, withAlpha } from '@/lib/holidays';

// 标题文字色：MAX_DEPTH=4 后共 5 档色阶（L0~L4）。
// L0~L2 底色较深用白字；L3/L4 底色偏浅用黑字（与之前"第三/四级黑字"一致，现在 L3/L4 正好对应第三/四级）。
function textColorForLevel(level) {
  return level >= 3 ? '#000000' : '#ffffff';
}

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

  // 左侧标签列宽：动态计算，覆盖 编号前缀 + 层级缩进 + 项目/任务名 全显示
  const LABEL_W = useMemo(() => {
    const names = [
      ...(projects || []).map((p) => `${p.code || ''} ${p.name || ''}`),
      ...filteredTasks.map((t) => t.title || ''),
      ...filteredMilestones.map((m) => m.title || ''),
    ];
    const maxLen = names.reduce((m, s) => Math.max(m, String(s).length), 0);
    return Math.min(480, Math.max(192, 32 + maxLen * 11)); // 11px/字符(text-sm) + 32px padding
  }, [projects, filteredTasks, filteredMilestones]);

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

  // 分组：先按 projectId 聚合；再补全「选中范围内有项目但无任务/里程碑的空项目」，使空子项目也能显示汇总行
  const groupByProject = useMemo(() => {
    const groups = {};
    allItems.forEach((item) => {
      if (!groups[item.projectId]) groups[item.projectId] = [];
      groups[item.projectId].push(item);
    });
    // 把范围内无任务的空项目补进来（items 为空数组），让时间线也能展示子项目
    (projects || []).forEach((p) => {
      if (activeProjectIds.has(p.id) && !groups[p.id]) groups[p.id] = [];
    });
    // 按项目编号字典序稳定排序
    const sortedEntries = Object.entries(groups).sort(([idA], [idB]) => {
      const codeA = (projects || []).find((p) => p.id === idA)?.code || idA;
      const codeB = (projects || []).find((p) => p.id === idB)?.code || idB;
      return (codeA || '').localeCompare(codeB || '');
    });
    return sortedEntries;
  }, [allItems, projects, activeProjectIds]);

  const todayPosition = getPosition(todayISO);

  // 打开页面时把“今天”滚动到可视区中央（任务标签列为 LABEL_W 动态宽度，需从可视宽度中扣除）
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const visibleW = Math.max(0, el.clientWidth - LABEL_W);
      const center = todayPosition + dayWidth / 2 - visibleW / 2;
      const max = el.scrollWidth - el.clientWidth;
      el.scrollTo({ left: Math.max(0, Math.min(center, max)), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [todayPosition, chartStartDate, totalDays, dayWidth, LABEL_W]);

  // 项目主题：按「主项目家族」共享基础色，子项目在该色基础上逐级变浅。
  // - 基础色由家族根项目（主项目）的编号字典序轮 4 色决定，保证同一家族主/子同源
  // - 子项目汇总行底色 = 家族基础色的 levelShades[level]，每级肉眼可辨、最浅档仍深于任务底色
  const familyThemes = useMemo(() => {
    const active = (projects || []).filter((p) => !p.archived);
    const roots = active.filter((p) => !p.parentProjectId);
    const sortedRoots = [...roots].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    // 根项目 id -> 家族基础主题
    const rootTheme = new Map();
    sortedRoots.forEach((p, idx) => rootTheme.set(p.id, PROJECT_THEMES[idx % PROJECT_THEMES.length]));
    // 任意项目 -> 家族基础主题（沿祖先链找到根）
    const projectThemeMap = new Map();
    active.forEach((p) => {
      const chain = getAncestors(projects || [], p.id); // 根 → ... → 直属父
      const rootId = chain.length > 0 ? chain[0].id : p.id;
      projectThemeMap.set(p.id, rootTheme.get(rootId) || PROJECT_THEMES[0]);
    });
    return projectThemeMap;
  }, [projects]);

  // 取某项目在某层级的汇总行底色（主项目 level=0 → 基础色；子项目逐级变浅）
  const getRowBg = (projectId, level) => {
    const theme = familyThemes.get(projectId) || PROJECT_THEMES[0];
    return getLevelShade(theme, level);
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
          <div className="flex items-center gap-1.5">
            <span className="w-0.5 h-4 bg-blue-500"></span>
            <span className="text-slate-500">计划变更</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-10 h-2.5 bg-slate-500 rounded"></span>
            <span className="text-slate-500">已废止</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-sm border border-slate-200"
              style={{ backgroundColor: OFF_DAY_BG }}
            ></span>
            <span className="text-slate-500">周末/法定节假日</span>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="overflow-x-auto gantt-scroll" ref={scrollRef}>
        <div className="min-w-max">
          {/* Date Header - Month labels */}
          <div className="flex border-b border-slate-100 sticky top-0 bg-white z-20">
            <div className="shrink-0 px-4 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-r border-slate-100 sticky left-0 z-30" style={{ width: LABEL_W }}>
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
            <div className="shrink-0 bg-slate-50 border-r border-slate-100 sticky left-0 z-10" style={{ width: LABEL_W }}></div>
            <div className="flex-1 flex overflow-hidden">
              {days.map((day, i) => {
                const dayType = getDayType(day.date);
                const off = dayType === 'weekend' || dayType === 'holiday';
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-col items-center justify-center text-[10px] text-slate-400 border-r border-slate-50',
                      day.isToday && 'bg-primary-50 text-primary-600 font-medium'
                    )}
                    style={{
                      width: dayWidth,
                      backgroundColor: !day.isToday && off ? OFF_DAY_BG : undefined,
                    }}
                  >
                    <span>{format(day.date, 'd')}</span>
                    {!day.isToday && dayType === 'makeup' && (
                      <span className="text-[8px] leading-none text-amber-600 font-medium">班</span>
                    )}
                    {!day.isToday && off && (
                      <span className="text-[8px] leading-none text-slate-400 font-medium">休</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-slate-50">
            {groupByProject.map(([projectId, items], projectIdx) => {
              const theme = familyThemes.get(projectId) || PROJECT_THEMES[0];
              const curProject = (projects || []).find((p) => p.id === projectId);
              // 层级缩进：每级 8 空格（≈2 个英文字符宽）；子项目比父项目缩进一级，任务与所属项目左对齐
              const level = getLevel(projects || [], projectId);
              const indent = ' '.repeat(level * 8);
              // 项目编号前缀（无编号时不显示）
              const codePrefix = curProject?.code ? `${curProject.code} ` : '';
              // 家族色阶：主项目 level=0 取基础色，子项目逐级变浅（最浅档仍深于任务底色）
              const rowBg = getRowBg(projectId, level);
              // 标题文字色：第三、四级子项目底色偏浅→黑字，主/一/二级→白字
              const titleColor = textColorForLevel(level);
              return (
              <div key={projectId}>
                {/* Summary Row */}
                <div
                  className="flex transition-smooth"
                  style={{ height: summaryRowHeight, backgroundColor: rowBg }}
                >
                  <div
                    className="shrink-0 px-4 py-2 border-r flex items-center sticky left-0 z-30"
                    style={{ width: LABEL_W, backgroundColor: rowBg, color: titleColor }}
                  >
                    <p className="text-sm font-medium truncate">
                      <span className="whitespace-pre">{indent}{codePrefix}</span>
                      <span>{curProject?.name || projectId}</span>
                    </p>
                  </div>
                  <div className="flex-1 relative" style={{ width: totalWidth, height: summaryRowHeight }}>
                    {/* 最底层：周末/节假日淡灰底（置于项目色带之下，不遮挡标题栏） */}
                    <div className="absolute inset-0 flex">
                      {days.map((day, i) => (
                        <div
                          key={i}
                          className="border-r h-full"
                          style={{
                            width: dayWidth,
                            backgroundColor: !day.isToday && isOffDay(day.date) ? OFF_DAY_BG : undefined,
                          }}
                        />
                      ))}
                    </div>
                    {/* 项目色带层：置于灰底之上，始终不被遮挡；周末以半透明让灰底透出 */}
                    <div className="absolute inset-0 flex">
                      {days.map((day, i) => {
                        const off = !day.isToday && isOffDay(day.date);
                        return (
                          <div
                            key={i}
                            className={cn('border-r h-full', theme.accent)}
                            style={{
                              width: dayWidth,
                              backgroundColor: day.isToday
                                ? '#fef2f2'
                                : off
                                  ? withAlpha(rowBg, 0.55)
                                  : rowBg,
                            }}
                          />
                        );
                      })}
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
                  // 任务行底色：项目内按「第1个=白、第2个=最浅档30%深度、第3个=白…」严格交替
                  // 偶数行用 白→家族最浅档 的 30% 混合，比之前最浅档更浅，与白底仍有可辨区分
                  const taskAltBg = getTaskAltBg(theme);
                  const isEvenTask = idx % 2 === 0;
                  const taskRowBg = isEvenTask ? '#ffffff' : taskAltBg;

                  return (
                    <div
                      key={item.id}
                      className="flex hover:bg-opacity-80 transition-smooth"
                      style={{ height: rowHeight, backgroundColor: taskRowBg }}
                    >
                      {/* Task Info - sticky left column */}
                      <div
                        className="shrink-0 px-4 py-2 border-r flex items-center sticky left-0 z-30"
                        style={{ width: LABEL_W, backgroundColor: taskRowBg }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate flex items-center gap-1.5">
                            <span className="whitespace-pre shrink-0">{indent}</span>
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
                            <span className="truncate">{item.title}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {item.startDate}
                            {item.dueDate && item.startDate !== item.dueDate && ` → ${item.dueDate}`}
                          </p>
                        </div>
                      </div>

                      {/* Gantt Area */}
                      <div className="flex-1 relative" style={{ width: totalWidth }}>
                        {/* 最底层：周末/节假日淡灰底（置于行底色之下，不遮挡内容） */}
                        <div className="absolute inset-0 flex">
                          {days.map((day, i) => (
                            <div
                              key={i}
                              className="border-r h-full"
                              style={{
                                width: dayWidth,
                                backgroundColor: !day.isToday && isOffDay(day.date) ? OFF_DAY_BG : undefined,
                              }}
                            />
                          ))}
                        </div>
                        {/* 行底色层：置于灰底之上；周末半透明让灰底透出，工作日实心不遮挡 */}
                        <div className="absolute inset-0 flex">
                          {days.map((day, i) => {
                            const off = !day.isToday && isOffDay(day.date);
                            return (
                              <div
                                key={i}
                                className={cn('border-r h-full', theme.accent)}
                                style={{
                                  width: dayWidth,
                                  backgroundColor: day.isToday
                                    ? '#fef2f2'
                                    : off
                                      ? withAlpha(taskRowBg, 0.55)
                                      : taskRowBg,
                                }}
                              />
                            );
                          })}
                        </div>

                        {/* Today Line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-red-400 opacity-70 z-10"
                          style={{ left: todayPosition + dayWidth / 2 }}
                        />

                        {/* Plan Bar（计划时间线）- 向下增粗 5 倍；里程碑不显示计划线。
                            已废止任务：整条计划线变深灰并悬停显示废止原因。 */}
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
                            title={item.abolished ? `任务已废止：${item.abolishReason || ''}` : '点击查看任务详情'}
                          >
                            <div
                              className="h-full rounded"
                              style={{
                                backgroundColor: item.abolished ? '#6b7280' : '#60a5fa',
                                opacity: item.abolished ? 1 : 0.7,
                              }}
                            />
                          </div>
                        )}

                        {/* 修改计划标记：原计划截止点蓝色小竖线（悬停显示修改原因）。
                            与「汇报节点」竖线同形，颜色取蓝；已废止任务不再绘制。 */}
                        {!isMilestone && !item.abolished && (item.modifications || []).map((mod, i) => {
                          if (!mod.originalDueDate) return null;
                          const markerX = getPosition(mod.originalDueDate) + dayWidth;
                          const modTop = PLAN_TOP + LINE_W / 2 - (LINE_W * 1.5) / 2;
                          return (
                            <div
                              key={`mod-${i}`}
                              className="absolute z-20"
                              style={{
                                left: markerX - 1.5,
                                top: modTop,
                                width: 3,
                                height: LINE_W * 1.5,
                                background: '#3b82f6',
                                borderRadius: 1,
                              }}
                              title={`计划变更：${mod.reason || ''}`}
                            />
                          );
                        })}

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
                                        left: segRight - (LINE_W + 2) / 2,
                                        top: ACTUAL_CENTER - (LINE_W + 2) / 2,
                                        width: LINE_W + 2,
                                        height: LINE_W + 2,
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
                                  left: actualLeft - (LINE_W + 2) / 2,
                                  top: ACTUAL_CENTER - (LINE_W + 2) / 2,
                                  width: LINE_W + 2,
                                  height: LINE_W + 2,
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
