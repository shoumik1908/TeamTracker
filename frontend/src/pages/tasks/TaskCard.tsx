import React from "react";
import { Check, GripVertical, Flag, Calendar, Pencil, Trash2, MessageSquare, Clock } from "lucide-react";
import { TaskPriority, TaskRow } from "../../types/tasks";

const PRIORITIES: Record<TaskPriority, { label: string; text: string }> = {
  CRITICAL: { label: "Critical", text: "text-rose-400" },
  HIGH: { label: "High", text: "text-orange-400" },
  MEDIUM: { label: "Medium", text: "text-amber-400" },
  LOW: { label: "Low", text: "text-emerald-400" },
};

const AVATAR_COLORS = ["bg-blue-600", "bg-fuchsia-600", "bg-teal-600", "bg-orange-600", "bg-violet-600", "bg-pink-600"];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface TaskCardProps {
  task: TaskRow;
  isAdmin: boolean;
  currentMemberId?: string;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onEdit?: (task: TaskRow) => void;
  onView: (task: TaskRow) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
}

export const TaskCard = React.memo(function TaskCard({
  task, isAdmin, currentMemberId, onDragStart, onEdit, onView, onDelete, onToggleDone
}: TaskCardProps) {
  const p = PRIORITIES[task.priority];
  const overdue = task.dueDate && new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0) && task.status !== "DONE";

  const myFeedback = currentMemberId
    ? task.feedbacks?.find((f) => f.assigneeId === currentMemberId)
    : undefined;

  const feedbackCount = task.feedbacks?.length ?? 0;
  const assigneeCount = task.assignments?.length ?? 0;
  const allSubmitted = feedbackCount >= assigneeCount && assigneeCount > 0;
  
  const inProgressCount = task.assignments?.filter(a => a.status === 'IN_PROGRESS' || a.status === 'DONE').length ?? 0;
  const showInProgressBubble = isAdmin && task.status === 'TODO' && inProgressCount > 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onView(task)}
      className="group relative rounded-lg border border-white/5 bg-[#1c1926]/80 backdrop-blur-md p-3 pl-2.5 shadow-sm hover:border-white/10 transition-colors cursor-grab active:cursor-grabbing"
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

        <div className="min-w-0 flex-1 pt-0.5">
          <h4 className="text-sm font-semibold text-white truncate group-hover:text-indigo-400 transition-colors">
            <span className="text-white/40 font-normal mr-1.5">#{task.taskNumber}</span>
            {task.title}
          </h4>

          {/* Multi-assignee avatars */}
          {task.assignments && task.assignments.length > 0 && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {task.assignments.slice(0, 4).map((a) => (
                <span
                  key={a.id}
                  title={a.member.name}
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor(a.member.name)}`}
                >
                  {initials(a.member.name)}
                </span>
              ))}
              {task.assignments.length > 4 && (
                <span className="text-[10px] text-neutral-500">+{task.assignments.length - 4}</span>
              )}
            </div>
          )}

          {task.onBehalfOf && (
            <p className="mt-1 text-[10px] text-indigo-400 font-medium">
              Requested by {task.onBehalfOf.name}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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

            {/* My feedback submitted badge */}
            {!isAdmin && myFeedback && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                <MessageSquare className="h-3 w-3" />
                Submitted
              </span>
            )}

            {/* Progress: X/N submitted */}
            {(isAdmin || assigneeCount > 1) && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border font-medium ${
                allSubmitted
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-white/5 border-white/5 text-white/40"
              }`}>
                <MessageSquare className="h-3 w-3" />
                {feedbackCount}/{assigneeCount}
              </span>
            )}

            {/* IN Progress bubble for admins */}
            {showInProgressBubble && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                <Clock className="h-3 w-3" />
                {inProgressCount}/{assigneeCount} in progress
              </span>
            )}

          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="absolute right-2 top-2 hidden items-center gap-1 group-hover:flex">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(task); }}
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
