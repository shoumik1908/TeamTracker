import React, { useMemo, useState, useCallback } from "react";
import { Plus, Search, InboxIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useAssignableMembers,
  useCurrentUser,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "../../api/tasksQueries";
import { TaskRow, TaskStatus } from "../../types/tasks";
import { TaskCard } from "./TaskCard";
import { TaskFormDialog } from "./TaskFormDialog";
import { TaskDetailModal } from "./TaskDetailModal";
import { FeedbackModal } from "./FeedbackModal";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

type TabId = "assigned-to-me" | "assigned-by-me";

export default function TasksPage() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const isAdmin = currentUser?.permissions?.["tasks:manage"] === true || currentUser?.permissions?.["manageTeam"] === true;
  const currentMemberId = currentUser?.teamMemberId as string | undefined;
  const currentUserId = currentUser?.id as string | undefined;

  const { data: members } = useAssignableMembers();

  const [tab, setTab] = useState<TabId>("assigned-to-me");
  const [editModalTask, setEditModalTask] = useState<TaskRow | null | undefined>(undefined);
  const [detailModalTask, setDetailModalTask] = useState<TaskRow | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [feedbackTask, setFeedbackTask] = useState<TaskRow | null>(null);

  const { data: tasks, isLoading: tasksLoading, isError } = useTasks(!userLoading);
  const isLoading = userLoading || tasksLoading;

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t: TaskRow) => {
      // Tab filter
      if (tab === "assigned-to-me") {
        // Show tasks where current member is an assignee
        const isAssigned = currentMemberId
          ? t.assignments?.some((a) => a.memberId === currentMemberId)
          : false;
        // Admins with no teamMemberId fall back to showing all tasks in this tab
        if (currentMemberId && !isAssigned) return false;
      } else {
        // "assigned-by-me": tasks the current user created themselves,
        // OR tasks assigned on behalf of the current user by someone else.
        const createdByMe = currentUserId && t.assignedBy?.id === currentUserId;
        const onBehalfOfMe = currentMemberId && t.onBehalfOf?.id === currentMemberId;
        if (!createdByMe && !onBehalfOfMe) return false;
      }

      if (priorityFilter !== "all" && t.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      if (query) {
        const q = query.toLowerCase();
        const nameMatch = t.assignments?.some((a) => a.member.name.toLowerCase().includes(q));
        if (!t.title.toLowerCase().includes(q) && !nameMatch) return false;
      }
      return true;
    });
  }, [tasks, tab, priorityFilter, query, currentMemberId, currentUserId]);

  function hasFeedback(task: TaskRow): boolean {
    if (!currentMemberId) return false;
    return task.feedbacks?.some((f) => f.assigneeId === currentMemberId) ?? false;
  }

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setDragOverCol(null);

    const task = tasks?.find((t: TaskRow) => t.id === id);
    if (!task || task.status === colId) return;

    if (colId === "DONE" && !isAdmin) {
      if (!hasFeedback(task)) { setFeedbackTask(task); return; }
    }

    updateTask.mutate(
      { id, input: { status: colId } },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update task") }
    );
  }, [updateTask, tasks, isAdmin, currentMemberId]);

  const toggleDone = useCallback((id: string) => {
    const task = tasks?.find((t: TaskRow) => t.id === id);
    if (!task) return;
    const newStatus: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
    if (newStatus === "DONE" && !isAdmin && !hasFeedback(task)) {
      setFeedbackTask(task); return;
    }
    updateTask.mutate(
      { id, input: { status: newStatus } },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update task") }
    );
  }, [tasks, updateTask, isAdmin, currentMemberId]);

  const handleDelete = useCallback((id: string) => {
    if (!window.confirm("Delete this task? This can't be undone.")) return;
    deleteTask.mutate(id, {
      onSuccess: () => toast.success("Task deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete task"),
    });
  }, [deleteTask]);

  function handleSaveTask(taskData: any) {
    if (!editModalTask) {
      createTask.mutate(
        {
          title: taskData.title.trim(),
          description: taskData.description?.trim() || undefined,
          assigneeIds: taskData.assigneeIds,
          priority: taskData.priority,
          dueDate: taskData.due || null,
          onBehalfOfId: taskData.onBehalfOfId || undefined,
        },
        {
          onSuccess: () => { toast.success("Task created"); setEditModalTask(undefined); },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't create task"),
        }
      );
    } else {
      const input = isAdmin
        ? { title: taskData.title.trim(), description: taskData.description?.trim() || undefined, priority: taskData.priority, dueDate: taskData.due || null, status: taskData.status }
        : { status: taskData.status };

      updateTask.mutate(
        { id: editModalTask.id, input },
        {
          onSuccess: () => { toast.success("Task updated"); setEditModalTask(undefined); },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update task"),
        }
      );
    }
  }

  if (userLoading) {
    return (
      <div className="min-h-full bg-transparent p-8 text-neutral-100 flex items-center justify-center">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "assigned-to-me", label: "Assigned to me", icon: <InboxIcon className="h-3.5 w-3.5" /> },
    { id: "assigned-by-me", label: "Assigned by me", icon: <SendIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-full bg-transparent p-8 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Tasks</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Track work assigned to you and tasks you've delegated.
            </p>
          </div>
          <button
            onClick={() => setEditModalTask(null)}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/10 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New task
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex items-center gap-1 rounded-xl border border-white/5 bg-[#1c1926]/60 p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#1c1926]/80 backdrop-blur-md px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by task or person"
              className="w-48 bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none"
            />
          </div>
          <div className="flex gap-1">
            {["all", "critical", "high", "medium", "low"].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  priorityFilter === p ? "bg-white/10 text-white border border-white/5 shadow-sm" : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent"
                }`}
              >
                {p === "all" ? "All priorities" : p}
              </button>
            ))}
          </div>
        </div>

        {isError && <p className="text-sm text-rose-400 mb-4">Couldn't load tasks. Try refreshing the page.</p>}

        {!isError && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t: TaskRow) => {
                if (tab === "assigned-to-me") {
                  // Use the member's personal assignment status
                  const memberStatus = currentMemberId
                    ? t.assignments?.find(a => a.memberId === currentMemberId)?.status
                    : undefined;
                  return (memberStatus || t.status) === col.id;
                }
                // "assigned-by-me" — use aggregate task status
                return t.status === col.id;
              });
              const isOver = dragOverCol === col.id;
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                  onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`rounded-xl border p-3 transition-colors ${
                    isOver ? "border-indigo-500/60 bg-indigo-500/10" : "border-white/5 bg-[#1c1926]/80 backdrop-blur-md shadow-md"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{col.label}</span>
                    <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-400">
                      {isLoading ? "…" : colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2 min-h-[120px]">
                    {isLoading ? (
                      <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/40">Loading...</div>
                    ) : colTasks.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/40">
                        No tasks {query || priorityFilter !== "all" ? "match this filter." : "pending."}
                      </div>
                    ) : (
                      colTasks.map((t: TaskRow) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          isAdmin={isAdmin}
                          currentMemberId={currentMemberId}
                          onDragStart={handleDragStart}
                          onEdit={isAdmin || tab === "assigned-by-me" ? setEditModalTask : undefined}
                          onView={setDetailModalTask}
                          onDelete={handleDelete}
                          onToggleDone={toggleDone}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editModalTask !== undefined && (
        <TaskFormDialog
          initial={editModalTask}
          members={members || []}
          isAdmin={isAdmin}
          onClose={() => setEditModalTask(undefined)}
          onSave={handleSaveTask}
        />
      )}

      {detailModalTask && (
        <TaskDetailModal
          taskId={detailModalTask.id}
          onClose={() => setDetailModalTask(null)}
          onEditTask={isAdmin ? (task) => {
            setDetailModalTask(null);
            setEditModalTask(task);
          } : undefined}
        />
      )}

      {feedbackTask && (
        <FeedbackModal
          task={feedbackTask}
          onClose={() => setFeedbackTask(null)}
          onFeedbackSubmitted={() => setFeedbackTask(null)}
        />
      )}
    </div>
  );
}

