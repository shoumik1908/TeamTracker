import { CreateTaskInput, TaskRow, UpdateTaskInput } from "../types/tasks";
import api from "../lib/api";
export async function fetchTasks(params?: {
  assigneeId?: string;
  status?: string;
}): Promise<TaskRow[]> {
  const res = await api.get<TaskRow[]>("/tasks", { params });
  return res.data;
}

export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  const res = await api.post<TaskRow>("/tasks", input);
  return res.data;
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<TaskRow> {
  const res = await api.patch<TaskRow>(`/tasks/${id}`, input);
  return res.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export interface AssignableMember {
  id: string;
  name: string;
}

export async function fetchAssignableMembers(): Promise<AssignableMember[]> {
  const res = await api.get<{ data: AssignableMember[] }>("/members?limit=1000");
  return res.data.data;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
  teamMemberId?: string;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await api.get<any>("/auth/me");
  const user = res.data.user;
  return {
    id: user.id,
    email: user.email,
    role: user.role?.name || "",
    permissions: user.role?.permissions || {},
    teamMemberId: user.teamMemberId,
  };
}
