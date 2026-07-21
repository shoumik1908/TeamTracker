export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TaskMember {
  id: string;
  name: string;
}

export interface TaskAssignment {
  id: string;
  memberId: string;
  member: TaskMember;
  status: TaskStatus;
}

export interface TaskProject {
  id: string;
  name: string;
}

export interface TaskFeedback {
  id: string;
  assigneeId: string;
  feedbackText: string;
  rating?: number | null;
  attachments?: { url: string; name: string }[];
  submittedAt: string;
}

export interface TaskRow {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  assignedBy: { id: string; name: string };
  onBehalfOf?: { id: string; name: string } | null;
  onBehalfOfId?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  assignments: TaskAssignment[];
  project: TaskProject | null;
  feedbacks: TaskFeedback[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeIds: string[];
  priority?: TaskPriority;
  dueDate?: string;
  projectId?: string;
  onBehalfOfId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  status?: TaskStatus;
}

export interface SubmitFeedbackInput {
  feedbackText: string;
  rating?: number | null;
  files?: File[];
}

export const STATUS_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "DONE", label: "Done" },
];
