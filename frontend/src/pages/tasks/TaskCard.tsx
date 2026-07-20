import React from "react";
import { Check, GripVertical, Flag, Calendar, Pencil, Trash2 } from "lucide-react";
import { TaskPriority, TaskRow } from "../../types/tasks";

const PRIORITIES: Record<TaskPriority, { label: string; text: string }> = {
  CRITICAL: { label: "Critical", text: "text-rose-400" },
  HIGH: { label: "High", text: "text-orange-400" },
  MEDIUM: { label: "Medium", text: "text-amber-400" },
  LOW: { label: "Low", text: "text-emerald-400" },
};

const TEAM = ["Suhani Verma", "Aditi Sharma", "Akshay Rao", "Mayank Jhamb"];
const AVATAR_COLORS = ["bg-blue-600", "bg-fuchsia-600", "bg-teal-600", "bg-orange-600"];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function avatarColor(name: string) {
  // Try to keep colors deterministic based on name length/chars if not in TEAM array
  const idx = TEAM.indexOf(name);
  if (idx >= 0) return AVATAR_COLORS[idx % AVATAR_COLORS.length];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface TaskCardProps {
  task: TaskRow;
  isAdmin: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onEdit: (task: TaskRow) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
}

export const TaskCard = React.memo(function TaskCard({ task, isAdmin, onDragStart, onEdit, onDelete, onToggleDone }: TaskCardProps) {
  const p = PRIORITIES[task.priority];
  const overdue = task.dueDate && new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0) && task.status !== "DONE";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onEdit(task)}
      className="group relative rounded-lg border border-white/5 bg-[#1c1926]/80 backdrop-blur-md p-3 pl-2.5 shadow-sm hover:border-white/5 transition-colors cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700 group-hover:text-neutral-500" />

        <button
          onClick={(e) => { e.stopPropagation(); onToggleDone(task.id); }}
          title={task.status === "DONE" ? "Mark as not done" : "Mark as done"}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
            task.status === "DONE"
              ? "border-blue-500 bg-blue-500 text-white"
              : "border-neutral-600 text-transparent hover:border-blue-500"
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${task.status === "DONE" ? "text-neutral-500 line-through" : "text-neutral-100"}`}>
            {task.title}
          </p>
          {task.assignee && (
            <p className="mt-0.5 text-xs text-neutral-400 truncate">
              {task.assignee.name}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/5 px-2 py-0.5 text-[11px] font-medium ${p.text}`}>
              <Flag className="h-3 w-3" />
              {p.label}
            </span>

            {task.dueDate && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border font-medium ${
                overdue ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-white/5 text-white/50 border-white/5"
              }`}>
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}

            {task.assignee && (
              <span
                title={task.assignee.name}
                className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(task.assignee.name)}`}
              >
                {initials(task.assignee.name)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* hover actions */}
      {isAdmin && (
        <div className="absolute right-2 top-2 hidden items-center gap-1 group-hover:flex">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 bg-neutral-900"
            title="Edit task"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-rose-400 bg-neutral-900"
            title="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});
