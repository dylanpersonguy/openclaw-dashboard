"use client";

import { useMemo } from "react";

import { TaskCard } from "@/components/molecules/TaskCard";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  description?: string | null;
  due_at?: string | null;
  assigned_agent_id?: string | null;
  assignee?: string;
};

type TaskBoardProps = {
  tasks: Task[];
  onCreateTask: () => void;
  isCreateDisabled?: boolean;
  onTaskSelect?: (task: Task) => void;
};

const columns = [
  { title: "Inbox", status: "inbox" },
  { title: "Assigned", status: "assigned" },
  { title: "In Progress", status: "in_progress" },
  { title: "Testing", status: "testing" },
  { title: "Review", status: "review" },
  { title: "Done", status: "done" },
];

const formatDueDate = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export function TaskBoard({
  tasks,
  onCreateTask,
  isCreateDisabled = false,
  onTaskSelect,
}: TaskBoardProps) {
  const grouped = useMemo(() => {
    const buckets: Record<string, Task[]> = {};
    for (const column of columns) {
      buckets[column.status] = [];
    }
    tasks.forEach((task) => {
      const bucket = buckets[task.status] ?? buckets.inbox;
      bucket.push(task);
    });
    return buckets;
  }, [tasks]);

  return (
    <div className="grid grid-flow-col auto-cols-[minmax(260px,320px)] gap-6 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnTasks = grouped[column.status] ?? [];
        return (
          <div key={column.title} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-strong">
                {column.title}
              </h3>
              <span className="text-xs text-quiet">{columnTasks.length}</span>
            </div>
            <div className="space-y-3">
              {column.status === "inbox" ? (
                <button
                  type="button"
                  onClick={onCreateTask}
                  disabled={isCreateDisabled}
                  className={cn(
                    "flex w-full items-center justify-center rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-quiet transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface)]",
                    isCreateDisabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  New task
                </button>
              ) : null}
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  status={column.status}
                  assignee={task.assignee}
                  due={formatDueDate(task.due_at)}
                  onClick={() => onTaskSelect?.(task)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
