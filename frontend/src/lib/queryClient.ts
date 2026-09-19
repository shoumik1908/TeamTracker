import { QueryClient } from '@tanstack/react-query';

/**
 * The one QueryClient the app uses.
 *
 * It used to be created inline in main.tsx, which meant the only way to reach it was
 * useQueryClient() — and that requires a QueryClientProvider ancestor. AuthContext needs
 * to clear this cache on logout (TT-068), and making the auth provider depend on
 * provider ordering is a trap for whoever next renders it somewhere else. A module is
 * simpler and has no ordering requirement.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 1,
    },
  },
});
