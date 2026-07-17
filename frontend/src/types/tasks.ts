export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TaskAssignee {
  id: string;
  name: string;
}

export interface TaskProject {
  id: string;
  name: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // ISO date
  completedAt: string | null;
  assignee: TaskAssignee;
  project: TaskProject | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeId: string;
  priority?: TaskPriority;
  dueDate?: string;
  projectId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assigneeId?: string;
  priority?: TaskPriority;
  dueDate?: string;
  status?: TaskStatus;
}

export const STATUS_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "DONE", label: "Done" },
];
