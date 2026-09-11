import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import ProjectBreadcrumb from '@/components/projects/ProjectBreadcrumb';
import { useTaskStore } from '@/store/useTaskStore';
import { useProjectStore } from '@/store/useProjectStore';
import { TASK_STATUS_CONFIG, TASK_STATUS_ORDER } from '@/config/theme';
import { buildProjectThemeMap } from '@/lib/projectTheme';
import { cn } from '@/lib/utils';

// 看板中按「进行中」逻辑处理的列：按项目编号+启动时间排序、卡片按项目主题色渲染底色。
// 用户要求 待办/评审中/已完成/已阻塞 也按此逻辑展示（与「进行中」一致）。
const KANBAN_PROGRESS_STATUSES = new Set(['todo', 'in_progress', 'review', 'done', 'blocked']);

export default function TaskKanban({ tasks, onTaskClick, projectFilter, onEdit, onDelete, onProgress }) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);
  const allTasks = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));

  // 任务 projectId 兼容：projectId / project_id 两种写法（旧数据用 project_id）
  const getTaskProjectId = (task) => task.projectId || task.project_id;

  // 全局统一的项目→主题色映射（按 code 字典序，未归档项目参与循环；与甘特图保持一致）
  const projectThemeMap = useMemo(() => buildProjectThemeMap(projects), [projects]);

  // 进行中列按「项目编号 → 启动时间(createdAt/startDate) → id」稳定排序
  const getStartedAt = (task) =>
    task.createdAt || task.startDate || task.id || '';
  const compareByProjectAndStart = (a, b) => {
    const pa = projects.find((p) => p.id === getTaskProjectId(a));
    const pb = projects.find((p) => p.id === getTaskProjectId(b));
    const codeA = pa?.code || '';
    const codeB = pb?.code || '';
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    return getStartedAt(a).localeCompare(getStartedAt(b));
  };

  const columns = TASK_STATUS_ORDER.map((status) => {
    const statusTasks = tasks.filter(
      (t) => t.status === status && activeProjectIds.has(getTaskProjectId(t))
    );
    // 待办/进行中/评审中/已完成/已阻塞 均按项目编号 + 启动时间排序（与「进行中」一致）
    const orderedTasks = KANBAN_PROGRESS_STATUSES.has(status)
      ? [...statusTasks].sort(compareByProjectAndStart)
      : statusTasks;
    return {
      id: status,
      title: TASK_STATUS_CONFIG[status].label,
      color: TASK_STATUS_CONFIG[status].color,
      tasks: orderedTasks,
    };
  });

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    if (sourceCol === destCol) {
      // Reorder within column
      const colTasks = [...columns.find((c) => c.id === sourceCol).tasks];
      const [moved] = colTasks.splice(source.index, 1);
      colTasks.splice(destination.index, 0, moved);

      const newAllTasks = [...allTasks];
      colTasks.forEach((t, idx) => {
        const idx2 = newAllTasks.findIndex((x) => x.id === t.id);
        if (idx2 >= 0) newAllTasks[idx2] = { ...newAllTasks[idx2], order: idx };
      });
      reorderTasks(newAllTasks);
    } else {
      // Move to different column
      updateTask(draggableId, { status: destCol });
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto kanban-scroll pb-2">
        {columns.map((col) => (
          <Droppable key={col.id} droppableId={col.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  'w-72 shrink-0 bg-slate-50 rounded-lg p-3 transition-colors',
                  snapshot.isDraggingOver && 'bg-slate-100'
                )}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-medium text-slate-600">{col.title}</span>
                  </div>
                  <span className="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded">
                    {col.tasks.length}
                  </span>
                </div>

                <div className="space-y-2 min-h-[50px]">
                  {col.tasks.map((task, index) => {
                    const pid = getTaskProjectId(task);
                    const project = projects.find((p) => p.id === pid);
                    const isArchived = !activeProjectIds.has(pid);
                    // 待办/进行中/评审中/已完成/已阻塞 列均按项目编号填色：同项目同色，循环4色（淡灰/淡绿/淡蓝/淡桔）
                    const theme = KANBAN_PROGRESS_STATUSES.has(col.id) ? projectThemeMap.get(pid) : null;
                    return (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <ProjectBreadcrumb projectId={pid} projects={projects} className="mb-1" />
                            <TaskCard
                              task={task}
                              project={project}
                              onEdit={onEdit}
                              onDelete={onDelete}
                              onProgress={onProgress}
                              isArchived={isArchived}
                              bgClass={theme?.rowBg}
                              borderClass={theme?.border}
                            />
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>

                {col.tasks.length === 0 && !snapshot.isDraggingOver && (
                  <div className="text-center text-xs text-slate-300 py-4">拖拽任务到此处</div>
                )}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
