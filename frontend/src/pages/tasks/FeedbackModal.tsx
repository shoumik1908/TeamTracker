import React, { useState } from "react";
import { X, MessageSquare, Star } from "lucide-react";
import { useSubmitFeedback } from "../../api/tasksQueries";
import { TaskRow } from "../../types/tasks";
import { toast } from "sonner";

interface FeedbackModalProps {
  task: TaskRow;
  onClose: () => void;
  onFeedbackSubmitted: () => void; // called after successful submission — parent can then move task to DONE
}

export function FeedbackModal({ task, onClose, onFeedbackSubmitted }: FeedbackModalProps) {
  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const submitFeedback = useSubmitFeedback(task.id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    submitFeedback.mutate(
      { feedbackText: feedbackText.trim(), rating },
      {
        onSuccess: () => {
          toast.success("Feedback submitted — task marked as Done!");
          onFeedbackSubmitted();
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to submit feedback"),
      }
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1726] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Submit feedback to complete</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-neutral-500 hover:bg-white/10 hover:text-neutral-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Task title reference */}
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            <p className="text-xs text-neutral-500 mb-0.5">Task</p>
            <p className="text-sm text-neutral-200 font-medium leading-snug">{task.title}</p>
          </div>

          {/* Feedback text */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Feedback <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Share what you accomplished, any blockers you faced, or how the task went..."
              required
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 resize-none transition-colors"
            />
          </div>

          {/* Star rating (optional) */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2">
              Rating <span className="text-neutral-600">(optional)</span>
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? null : star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${
                      (hoverRating ?? rating ?? 0) >= star
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-neutral-600"
                    }`}
                  />
                </button>
              ))}
              {rating && (
                <span className="ml-1 text-xs text-neutral-500">
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!feedbackText.trim() || submitFeedback.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitFeedback.isPending ? "Submitting…" : "Submit & Mark Done"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
