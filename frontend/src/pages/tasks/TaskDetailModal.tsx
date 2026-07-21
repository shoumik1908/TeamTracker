import React, { useState, useEffect } from "react";
import { Star, MessageSquare, Users, Flag, Calendar, Loader2, CheckCircle2, Clock, X, Pencil, Paperclip, FileText } from "lucide-react";
import { useTask, useCurrentUser, useTaskFeedbacks, useSubmitFeedback } from "../../api/tasksQueries";
import { toast } from "sonner";
import { TaskRow } from "../../types/tasks";

const AVATAR_COLORS = ["bg-blue-600", "bg-fuchsia-600", "bg-teal-600", "bg-orange-600", "bg-violet-600", "bg-pink-600"];
function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-neutral-600 italic">No rating</span>;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-3.5 w-3.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-neutral-700"}`} />
      ))}
    </span>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "text-rose-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-amber-400",
  LOW: "text-emerald-400",
};

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onEditTask?: (task: TaskRow) => void;
}

export function TaskDetailModal({ taskId, onClose, onEditTask }: TaskDetailModalProps) {
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.permissions?.["tasks:manage"] === true || currentUser?.permissions?.["manageTeam"] === true;
  const currentMemberId = currentUser?.teamMemberId;

  const { data: task, isLoading, refetch } = useTask(taskId, !!taskId);
  const { data: feedbackData } = useTaskFeedbacks(taskId, isAdmin && !!taskId);
  const submitFeedback = useSubmitFeedback(taskId);

  // Inline feedback form state (for the current member)
  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);

  const feedbacks = isAdmin ? (feedbackData?.data ?? []) : (task?.feedbacks ?? []);
  const myFeedback = currentMemberId ? feedbacks.find((f: any) => f.assigneeId === currentMemberId) : undefined;

  useEffect(() => {
    if (myFeedback && !isEditingFeedback) {
      setFeedbackText(myFeedback.feedbackText || "");
      setRating(myFeedback.rating || null);
    }
  }, [myFeedback, isEditingFeedback]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="flex h-64 w-full max-w-2xl items-center justify-center rounded-2xl border border-white/5 bg-[#1c1926]/95 backdrop-blur-md shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  if (!task) return null;

  const assignments = task.assignments ?? [];
  const feedbackCount = feedbacks.length;
  const assigneeCount = assignments.length;
  const progress = assigneeCount > 0 ? Math.round((feedbackCount / assigneeCount) * 100) : 0;

  const isAssigned = currentMemberId ? assignments.some((a: any) => a.memberId === currentMemberId) : false;

  function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    submitFeedback.mutate(
      { feedbackText: feedbackText.trim(), rating, files: files.length > 0 ? files : undefined },
      {
        onSuccess: () => {
          toast.success("Response submitted successfully!");
          setIsEditingFeedback(false);
          setFiles([]);
          refetch();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to submit response"),
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div 
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/5 bg-[#1c1926]/95 backdrop-blur-md p-6 shadow-2xl flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[task.priority]}`}>
                <Flag className="h-3 w-3" />
                {task.priority}
              </span>
              {task.dueDate && (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                  <Calendar className="h-3 w-3" />
                  Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">
              <span className="text-white/40 font-normal mr-2">#{task.taskNumber}</span>
              {task.title}
            </h1>
            {task.onBehalfOf ? (
              <p className="mt-1 text-xs text-neutral-400">
                Requested by <span className="text-indigo-400">{task.onBehalfOf.name}</span>
              </p>
            ) : task.assignedBy && (
              <p className="mt-1 text-xs text-neutral-400">
                Created by {task.assignedBy.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && onEditTask && (
              <button onClick={() => onEditTask(task as any)} className="rounded-md p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors" title="Edit Task Details">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="rounded-md p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="prose prose-invert max-w-none text-sm text-neutral-300">
            {task.description.split('\n').map((line: string, i: number) => (
              <p key={i} className="mb-2 last:mb-0">{line}</p>
            ))}
          </div>
        )}

        {/* Assignees + progress */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">{assigneeCount} {assigneeCount === 1 ? "Assignee" : "Assignees"}</h2>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {assignments.map((a: any) => {
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    a.status === 'DONE'
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : a.status === 'IN_PROGRESS'
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                      : "border-white/10 bg-white/5 text-neutral-400"
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor(a.member.name)}`}>
                    {initials(a.member.name)}
                  </span>
                  {a.member.name}
                  <span className="text-[10px] uppercase tracking-wider ml-1 opacity-70 border-l border-white/20 pl-2">
                    {a.status?.replace('_', ' ')}
                  </span>
                  {a.status === 'DONE' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  {a.status === 'TODO' && <Clock className="h-3.5 w-3.5 text-neutral-600" />}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-500">
              <span>Response progress</span>
              <span className="font-semibold text-white">{feedbackCount}/{assigneeCount} submitted</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Submit Response Form / View My Response */}
        {isAssigned && !isAdmin && (
          <div className={`rounded-xl border p-5 ${myFeedback && !isEditingFeedback ? "border-emerald-500/20 bg-emerald-500/5" : "border-indigo-500/20 bg-indigo-500/5"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {myFeedback && !isEditingFeedback ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <MessageSquare className="h-4 w-4 text-indigo-400" />}
                <h2 className={`text-sm font-semibold ${myFeedback && !isEditingFeedback ? "text-emerald-300" : "text-indigo-300"}`}>
                  {myFeedback && !isEditingFeedback ? "Your Response" : (isEditingFeedback ? "Edit Response" : "Submit Response")}
                </h2>
                {myFeedback && !isEditingFeedback && <StarDisplay rating={myFeedback.rating} />}
              </div>
              
              {myFeedback && !isEditingFeedback && (
                <button 
                  onClick={() => setIsEditingFeedback(true)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-md transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>

            {myFeedback && !isEditingFeedback ? (
              <div>
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{myFeedback.feedbackText}</p>
                {myFeedback.attachments && myFeedback.attachments.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {myFeedback.attachments.map((att: any, idx: number) => (
                      <a 
                        key={idx}
                        href={att.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 w-fit rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 text-xs font-medium text-indigo-300 border border-indigo-500/20 transition-colors"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-xs">{att.name || "Attached File"}</span>
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-neutral-500">
                  Submitted {new Date(myFeedback.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 mb-2">
                  <label className="text-xs text-neutral-400 font-medium">Attach Files (Optional)</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        id="task-file-upload"
                        multiple
                        className="hidden"
                        onChange={(e) => setFiles(Array.from(e.target.files || []))}
                      />
                      <label
                        htmlFor="task-file-upload"
                        className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 transition-colors"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        Choose Files
                      </label>
                      <span className="text-xs text-neutral-500">
                        {files.length > 0 ? `${files.length} file(s) selected` : "No files selected"}
                      </span>
                    </div>
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {files.map((file, i) => (
                          <div key={i} className="flex items-center gap-1.5 rounded bg-indigo-500/10 px-2 py-1 border border-indigo-500/20">
                            <FileText className="h-3 w-3 text-indigo-400" />
                            <span className="text-[10px] text-indigo-300 truncate max-w-[150px]">{file.name}</span>
                            <button 
                              type="button" 
                              onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                              className="text-indigo-400 hover:text-white ml-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Share your progress, challenges, or final thoughts..."
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500/50 resize-none transition-colors"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Rating (optional):</span>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star className={`h-5 w-5 transition-colors ${(hoverRating ?? rating ?? 0) >= s ? "fill-amber-400 text-amber-400" : "fill-transparent text-neutral-600"}`} />
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  {isEditingFeedback && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingFeedback(false);
                        setFeedbackText(myFeedback.feedbackText || "");
                        setRating(myFeedback.rating || null);
                      }}
                      className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!feedbackText.trim() || submitFeedback.isPending}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                  >
                    {submitFeedback.isPending ? "Submitting…" : (isEditingFeedback ? "Update Response" : "Submit Response")}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* All feedback responses — admin view */}
        {isAdmin && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">All Responses</h2>
            </div>
            {feedbacks.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">No responses submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {feedbacks.map((f: any) => (
                  <div key={f.id} className="rounded-lg border border-white/5 bg-white/5 p-4 relative">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(f.assignee.name)}`}>
                        {initials(f.assignee.name)}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-neutral-200">{f.assignee.name}</span>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(f.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="ml-auto">
                        <StarDisplay rating={f.rating} />
                      </div>
                    </div>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap">{f.feedbackText}</p>
                    {f.attachments && f.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {f.attachments.map((att: any, idx: number) => (
                          <a 
                            key={idx}
                            href={att.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 w-fit rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 text-xs font-medium text-indigo-300 border border-indigo-500/20 transition-colors"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="truncate max-w-[150px]">{att.name || "Attached File"}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
