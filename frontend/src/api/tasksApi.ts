import { CreateTaskInput, TaskRow, UpdateTaskInput } from "../types/tasks";
import api from "../lib/api";
export async function fetchTasks(params?: { status?: string }): Promise<TaskRow[]> {
  const res = await api.get<TaskRow[]>("/tasks", { params });
  return res.data;
}

export async function fetchTask(id: string): Promise<TaskRow> {
  const res = await api.get<TaskRow>(`/tasks/${id}`);
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

// TT-122: the /auth/me fetch that backed the duplicate ['current-user'] cache lived
// here. useCurrentUser reads from AuthContext now, so nothing calls it. The CurrentUser
// type above is still the shape that hook returns.
