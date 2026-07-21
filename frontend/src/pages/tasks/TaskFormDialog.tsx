import { useEffect, useRef, useState } from "react";
import { X, Check, ChevronDown, Users } from "lucide-react";
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

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function TaskFormDialog({ initial, members, isAdmin, onClose, onSave }: TaskModalProps) {
  const isEditMode = initial !== null;
  const canEditDetails = isAdmin || !isEditMode;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Multi-select for new tasks; single-select for editing
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [onBehalfOfId, setOnBehalfOfId] = useState<string>("");

  // Dropdown open state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [onBehalfDropdownOpen, setOnBehalfDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const onBehalfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description || "");
      setAssigneeIds(initial.assignments?.map((a) => a.memberId) ?? []);
      setPriority(initial.priority);
      setDue(initial.dueDate ? initial.dueDate.slice(0, 10) : "");
      setStatus(initial.status);
    } else {
      setTitle("");
      setDescription("");
      setAssigneeIds([]);
      setPriority("MEDIUM");
      setDue("");
      setStatus("TODO");
      setOnBehalfOfId("");
    }
  }, [initial, members]);

  // Close dropdowns on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (onBehalfRef.current && !onBehalfRef.current.contains(e.target as Node)) {
        setOnBehalfDropdownOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function toggleMember(id: string) {
    if (isEditMode) {
      // Edit mode: single select
      setAssigneeIds([id]);
      setDropdownOpen(false);
    } else {
      // Create mode: multi-select
      setAssigneeIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  }

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedNames = members
    .filter((m) => assigneeIds.includes(m.id))
    .map((m) => m.name);

  const canSave = title.trim().length > 0 && assigneeIds.length > 0;

  function handleSave() {
    if (!canSave) return;
    if (isEditMode) {
      onSave({ title, description, assigneeId: assigneeIds[0], priority, due, status });
    } else {
      // Pass array — TasksPage will create one task per assignee
      onSave({ title, description, assigneeIds, priority, due, status, onBehalfOfId: onBehalfOfId || undefined });
    }
  }

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
              <label className="mb-1 block text-xs font-medium text-white/50">
                Description <span className="text-white/30">(Optional)</span>
              </label>
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
              {/* Multi-select assignee dropdown */}
              <div ref={dropdownRef} className="relative">
                <label className="mb-1 block text-xs font-medium text-white/50">
                  {isEditMode ? "Assign to" : "Assign to"}
                  {!isEditMode && assigneeIds.length > 1 && (
                    <span className="ml-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                      {assigneeIds.length} selected
                    </span>
                  )}
                </label>

                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30 hover:border-white/20 transition-colors"
                >
                  <span className="truncate text-left">
                    {assigneeIds.length === 0
                      ? "Select…"
                      : assigneeIds.length === 1
                      ? selectedNames[0]
                      : `${assigneeIds.length} members`}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#1a1726] shadow-xl overflow-hidden">
                    {/* Search */}
                    <div className="border-b border-white/10 px-2 py-1.5">
                      <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search members…"
                        className="w-full bg-transparent text-xs text-white placeholder-white/30 outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Member list */}
                    <div className="max-h-48 overflow-y-auto py-1">
                      {filteredMembers.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-white/30">No matches</p>
                      ) : (
                        filteredMembers.map((m) => {
                          const selected = assigneeIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleMember(m.id)}
                              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                                selected
                                  ? "bg-indigo-500/15 text-white"
                                  : "text-white/70 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              {/* Avatar */}
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                                {initials(m.name)}
                              </span>
                              <span className="flex-1 truncate">{m.name}</span>
                              {/* Tick */}
                              {selected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-400" />}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Footer: show selection count + done button for multi-select */}
                    {!isEditMode && assigneeIds.length > 0 && (
                      <div className="border-t border-white/10 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-indigo-300">
                          <Users className="h-3 w-3" />
                          {assigneeIds.length} selected
                        </div>
                        <button
                          type="button"
                          onClick={() => setDropdownOpen(false)}
                          className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* On Behalf Of dropdown (only for creating tasks) */}
              {!isEditMode && (
              <div ref={onBehalfRef} className="relative">
                  <label className="mb-1 block text-xs font-medium text-white/50">
                    On behalf of (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setOnBehalfDropdownOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30 hover:border-white/20 transition-colors"
                  >
                    <span className="truncate text-left">
                      {onBehalfOfId === ""
                        ? "None"
                        : members.find(m => m.id === onBehalfOfId)?.name || "Unknown"}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform ${onBehalfDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {onBehalfDropdownOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#1a1726] shadow-xl overflow-hidden">
                      <div className="max-h-48 overflow-y-auto py-1">
                        <button
                          type="button"
                          onClick={() => { setOnBehalfOfId(""); setOnBehalfDropdownOpen(false); }}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                            onBehalfOfId === "" ? "bg-indigo-500/15 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span className="flex-1 truncate">None</span>
                          {onBehalfOfId === "" && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-400" />}
                        </button>
                        {members.map((m) => {
                          const selected = onBehalfOfId === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setOnBehalfOfId(m.id); setOnBehalfDropdownOpen(false); }}
                              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                                selected
                                  ? "bg-indigo-500/15 text-white"
                                  : "text-white/70 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                                {initials(m.name)}
                              </span>
                              <span className="flex-1 truncate">{m.name}</span>
                              {selected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                >
                  {Object.entries(PRIORITIES).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {canEditDetails && (
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">
                  Due date <span className="text-white/30">(Optional)</span>
                </label>
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
                  {COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
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
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/10 disabled:opacity-50 transition-colors shadow-sm"
          >
            {initial
              ? "Save changes"
              : assigneeIds.length > 1
              ? `Create ${assigneeIds.length} tasks`
              : "Create task"}
          </button>
        </div>
      </div>
    </div>
  );
}
