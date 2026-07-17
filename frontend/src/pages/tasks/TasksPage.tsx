import React, { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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


const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

export default function TasksPage() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const isAdmin = currentUser?.permissions?.["tasks:manage"] === true || currentUser?.permissions?.["manageTeam"] === true;

  const { data: members } = useAssignableMembers();

  const [modalTask, setModalTask] = useState<TaskRow | null | undefined>(undefined); // undefined = closed, null = new, object = edit
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [query, setQuery] = useState("");

  const { data: tasks, isLoading, isError } = useTasks();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      // Members only see their own tasks. Admins see all tasks.
      if (!isAdmin && t.assignee.id !== currentUser?.teamMemberId) return false;
      
      if (priorityFilter !== "all" && t.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      
      if (query) {
        const q = query.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.assignee.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, priorityFilter, query, isAdmin, currentUser?.id]);

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDrop(e: React.DragEvent, colId: TaskStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setDragOverCol(null);
    
    // Optimistic update via useUpdateTask
    updateTask.mutate(
      { id, input: { status: colId } },
      {
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update task"),
      }
    );
  }

  function toggleDone(id: string) {
    const task = tasks?.find(t => t.id === id);
    if (!task) return;
    
    const newStatus: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
    updateTask.mutate(
      { id, input: { status: newStatus } },
      {
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update task"),
      }
    );
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this task? This can't be undone.")) return;
    deleteTask.mutate(id, {
      onSuccess: () => toast.success("Task deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete task"),
    });
  }

  function handleSave(taskData: any) {
    if (!modalTask) {
      // Create mode
      createTask.mutate(
        {
          title: taskData.title.trim(),
          description: taskData.description?.trim() || undefined,
          assigneeId: taskData.assigneeId,
          priority: taskData.priority,
          dueDate: taskData.due || null,
        },
        {
          onSuccess: () => {
            toast.success("Task created");
            setModalTask(undefined);
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't create task"),
        }
      );
    } else {
      // Edit mode
      const input = isAdmin
        ? {
            title: taskData.title.trim(),
            description: taskData.description?.trim() || undefined,
            assigneeId: taskData.assigneeId,
            priority: taskData.priority,
            dueDate: taskData.due || null,
            status: taskData.status,
          }
        : { status: taskData.status };

      updateTask.mutate(
        { id: modalTask.id, input },
        {
          onSuccess: () => {
            toast.success("Task updated");
            setModalTask(undefined);
          },
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

  return (
    <div className="min-h-full bg-transparent p-8 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        {/* header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {isAdmin ? "Team tasks" : "My tasks"}
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              {isAdmin ? "Manage and track work across the team." : "Everything on your plate, in one place."}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setModalTask(null)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/10 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New task
            </button>
          )}
        </div>

        {/* filters */}
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

        {isError && (
          <p className="text-sm text-rose-400 mb-4">
            Couldn't load tasks. Try refreshing the page.
          </p>
        )}

        {/* board */}
        {!isError && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
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
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {isAdmin && col.id === "TODO" ? "Task list" : col.label}
                    </span>
                    <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-400">
                      {isLoading ? "…" : colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2 min-h-[120px]">
                    {isLoading ? (
                      <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/40">
                        Loading...
                      </div>
                    ) : colTasks.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/40">
                        No tasks {query || priorityFilter !== "all" ? "match this filter." : "pending."}
                      </div>
                    ) : (
                      colTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          isAdmin={isAdmin}
                          onDragStart={handleDragStart}
                          onEdit={setModalTask}
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

      {modalTask !== undefined && (
        <TaskFormDialog
          initial={modalTask}
          members={members || []}
          isAdmin={isAdmin}
          onClose={() => setModalTask(undefined)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
