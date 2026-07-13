import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client.
 * - Retries failed queries a couple of times with backoff.
 * - Avoids refetching on window focus to reduce noise during development.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
});
