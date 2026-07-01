import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Query-key factory (extended per feature). */
export const qk = {
  health: ['health'] as const,
  me: ['auth', 'me'] as const,
};
