import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TaskPriority, TaskRow, TaskStatus } from "../../types/tasks";

const PRIORITIES: Record<TaskPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

interface TaskModalProps {
  initial: TaskRow | null; // null = new task
  members: { id: string; name: string }[];
  isAdmin: boolean;
  onClose: () => void;
  onSave: (taskData: any) => void;
}

export function TaskFormDialog({ initial, members, isAdmin, onClose, onSave }: TaskModalProps) {
  const isEditMode = initial !== null;
  const canEditDetails = isAdmin; // Only admins edit details, members only edit status

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description || "");
      setAssigneeId(initial.assignee.id);
      setPriority(initial.priority);
      setDue(initial.dueDate ? initial.dueDate.slice(0, 10) : "");
      setStatus(initial.status);
    } else {
      setTitle("");
      setDescription("");
      setAssigneeId(members[0]?.id || "");
      setPriority("MEDIUM");
      setDue("");
      setStatus("TODO");
    }
  }, [initial, members]);

  const canSave = title.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-white/5 bg-[#1c1926]/80 backdrop-blur-md p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{initial ? "Edit task" : "New task"}</h3>
          <button onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          {canEditDetails && (
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Title</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Update project status"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
              />
            </div>
          )}

          {canEditDetails && (
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Description <span className="text-white/30">(Optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Any context they'll need"
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/30 resize-none"
              />
            </div>
          )}

          {!canEditDetails && isEditMode && initial.description && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-400">Description</label>
              <p className="text-sm text-neutral-300">{initial.description}</p>
            </div>
          )}

          {canEditDetails && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Assign to</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                >
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                >
                  {Object.entries(PRIORITIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {canEditDetails && (
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Due date <span className="text-white/30">(Optional)</span></label>
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
            )}
            
            {isEditMode && (
              <div className={!canEditDetails ? "col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-white/50">Column</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                >
                  {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/5 bg-transparent px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canSave && onSave({ title, description, assigneeId, priority, due, status })}
            disabled={!canSave}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/10 disabled:opacity-50 transition-colors shadow-sm"
          >
            {initial ? "Save changes" : "Create task"}
          </button>
        </div>
      </div>
    </div>
  );
}
