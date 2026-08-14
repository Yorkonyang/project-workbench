import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { useTaskStore } from '@/store/useTaskStore';
import { useProjectStore } from '@/store/useProjectStore';
import { TASK_STATUS_CONFIG, TASK_STATUS_ORDER } from '@/config/theme';
import { cn } from '@/lib/utils';

export default function TaskKanban({ tasks, onTaskClick, projectFilter, onEdit, onDelete, onProgress }) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);
  const allTasks = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));

  const columns = TASK_STATUS_ORDER.map((status) => ({
    id: status,
    title: TASK_STATUS_CONFIG[status].label,
    color: TASK_STATUS_CONFIG[status].color,
    tasks: tasks.filter((t) => t.status === status && activeProjectIds.has(t.projectId)),
  }));

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
                    const project = projects.find((p) => p.id === task.projectId);
                    const isArchived = !activeProjectIds.has(task.projectId);
                    return (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <TaskCard
                              task={task}
                              project={project}
                              onEdit={onEdit}
                              onDelete={onDelete}
                              onProgress={onProgress}
                              isArchived={isArchived}
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
