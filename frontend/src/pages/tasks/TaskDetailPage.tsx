import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, MessageSquare, Users, Flag, Calendar, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useTask, useCurrentUser, useTaskFeedbacks, useSubmitFeedback } from "../../api/tasksQueries";
import { useState } from "react";
import { toast } from "sonner";

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

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.permissions?.["tasks:manage"] === true || currentUser?.permissions?.["manageTeam"] === true;
  const currentMemberId = currentUser?.teamMemberId;

  const { data: task, isLoading, refetch } = useTask(id!, !!id);
  const { data: feedbackData } = useTaskFeedbacks(id!, isAdmin && !!id);
  const submitFeedback = useSubmitFeedback(id!);

  // Inline feedback form state (for the current member)
  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-8 text-neutral-400">Task not found.</div>
    );
  }

  const feedbacks = isAdmin ? (feedbackData?.data ?? []) : (task.feedbacks ?? []);
  const assignments = task.assignments ?? [];
  const feedbackCount = feedbacks.length;
  const assigneeCount = assignments.length;
  const progress = assigneeCount > 0 ? Math.round((feedbackCount / assigneeCount) * 100) : 0;

  const isAssigned = currentMemberId
    ? assignments.some((a: any) => a.memberId === currentMemberId)
    : false;
  const myFeedback = currentMemberId
    ? feedbacks.find((f: any) => f.assigneeId === currentMemberId)
    : undefined;

  function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    submitFeedback.mutate(
      { feedbackText: feedbackText.trim(), rating },
      {
        onSuccess: () => {
          toast.success("Feedback submitted!");
          setFeedbackText("");
          setRating(null);
          refetch();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to submit feedback"),
      }
    );
  }

  return (
    <div className="min-h-full bg-transparent p-6 md:p-8 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tasks
        </button>

        {/* Task header */}
        <div className="rounded-2xl border border-white/10 bg-[#1a1726] p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-white leading-snug mb-1">{task.title}</h1>
              {task.description && (
                <p className="text-sm text-neutral-400 leading-relaxed">{task.description}</p>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold border ${
              task.status === "DONE"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : task.status === "IN_PROGRESS"
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : "bg-white/5 border-white/10 text-neutral-400"
            }`}>
              {task.status === "DONE" ? "Done" : task.status === "IN_PROGRESS" ? "In Progress" : "To Do"}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3">
            <span className={`inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/5 px-2.5 py-1 text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? "text-white/50"}`}>
              <Flag className="h-3 w-3" />
              {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
            </span>
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/5 px-2.5 py-1 text-xs text-white/50">
                <Calendar className="h-3 w-3" />
                Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {/* Assignees + progress */}
        <div className="rounded-2xl border border-white/10 bg-[#1a1726] p-6 mb-4">
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
              <span>Feedback progress</span>
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

        {/* Inline feedback form — for assigned members who haven't submitted */}
        {isAssigned && !isAdmin && !myFeedback && (
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Submit your feedback</h2>
            </div>
            <form onSubmit={handleSubmitFeedback} className="space-y-3">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Share what you accomplished or any observations..."
                rows={4}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-indigo-500/60 resize-none transition-colors"
              />
              {/* Star rating */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Rating (optional):</span>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button"
                    onClick={() => setRating(rating === s ? null : s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star className={`h-5 w-5 transition-colors ${(hoverRating ?? rating ?? 0) >= s ? "fill-amber-400 text-amber-400" : "fill-transparent text-neutral-600"}`} />
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!feedbackText.trim() || submitFeedback.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {submitFeedback.isPending ? "Submitting…" : "Submit & Complete Task"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My submitted feedback — for members who already submitted */}
        {isAssigned && !isAdmin && myFeedback && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-emerald-300">Your feedback</h2>
              <StarDisplay rating={(myFeedback as any).rating} />
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{(myFeedback as any).feedbackText}</p>
            <p className="mt-2 text-xs text-neutral-500">
              Submitted {new Date((myFeedback as any).submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        )}

        {/* All feedback responses — admin view */}
        {isAdmin && (
          <div className="rounded-2xl border border-white/10 bg-[#1a1726] p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">All Responses</h2>
              <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                {feedbacks.length}
              </span>
            </div>

            {feedbacks.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-neutral-600">
                <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No responses yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbacks.map((fb: any) => (
                  <div key={fb.id} className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0 ${avatarColor(fb.assignee?.name ?? "?")}`}>
                          {initials(fb.assignee?.name ?? "?")}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-neutral-200">{fb.assignee?.name}</p>
                          <p className="text-[11px] text-neutral-500">
                            {new Date(fb.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <StarDisplay rating={fb.rating} />
                    </div>
                    <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap border-l-2 border-indigo-500/30 pl-3">
                      {fb.feedbackText}
                    </p>
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
