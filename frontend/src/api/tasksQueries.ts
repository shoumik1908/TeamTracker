import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  fetchAssignableMembers,
  fetchCurrentUser,
  fetchTasks,
  updateTask,
} from "./tasksApi";
import { CreateTaskInput, TaskRow, UpdateTaskInput } from "../types/tasks";

const TASKS_KEY = ["tasks"];
const MEMBERS_KEY = ["assignable-members"];
const CURRENT_USER_KEY = ["current-user"];

// Poll + refetch on focus so an admin assigning a task and a team member
// changing its status stay in sync across separate browser sessions
// without a full page reload. 15s keeps this cheap while still feeling
// "live" for a small internal team.
export function useTasks(filters?: { assigneeId?: string; status?: string }) {
  return useQuery({
    queryKey: [...TASKS_KEY, filters],
    queryFn: () => fetchTasks(filters),
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });
}

export function useAssignableMembers() {
  return useQuery({ queryKey: MEMBERS_KEY, queryFn: fetchAssignableMembers });
}

// If you already have an auth/user context elsewhere in the app, prefer
// that over this hook - this is a minimal standalone version so the page
// works even if that doesn't exist yet.
export function useCurrentUser() {
  return useQuery({ queryKey: CURRENT_USER_KEY, queryFn: fetchCurrentUser });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      updateTask(id, input),

    // Optimistically apply the change (status/priority/title/etc, minus
    // assigneeId - that one needs the server's resolved assignee name, so
    // it's skipped here and just picked up on the settle-refetch below).
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      await queryClient.cancelQueries({ queryKey: ['dashboard-tasks'] });

      const previousTasks = queryClient.getQueriesData<TaskRow[]>({
        queryKey: TASKS_KEY,
      });
      const previousDashboardTasks = queryClient.getQueriesData<any[]>({
        queryKey: ['dashboard-tasks'],
      });

      const { assigneeId, ...patchable } = input;

      queryClient.setQueriesData<TaskRow[]>({ queryKey: TASKS_KEY }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...patchable } : t))
      );

      queryClient.setQueriesData<any[]>({ queryKey: ['dashboard-tasks'] }, (old) =>
        old?.map((t) => {
          if (t.id === id) {
            const updated = { ...t, ...patchable };
            if (patchable.status === 'DONE' && t.status !== 'DONE') {
              updated.completedAt = new Date().toISOString();
            } else if (patchable.status && patchable.status !== 'DONE') {
              updated.completedAt = null;
            }
            return updated;
          }
          return t;
        })
      );

      return { previousTasks, previousDashboardTasks };
    },

    onError: (_err, _vars, context) => {
      context?.previousTasks?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.previousDashboardTasks?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
