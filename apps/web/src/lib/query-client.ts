import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';

/**
 * Shared query client.
 *
 * Defaults are chosen for a workspace app rather than a marketing site:
 * aggressive `staleTime` keeps navigation instant, and `retry` is skipped for
 * errors the client already knows are not worth repeating.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          switch (error.code) {
            case 'VALIDATION_ERROR':
            case 'UNAUTHORIZED':
            case 'TOKEN_EXPIRED':
            case 'FORBIDDEN':
            case 'NOT_FOUND':
            case 'CONFLICT':
            case 'TOO_MANY_REQUESTS':
              // Retrying cannot change the outcome of any of these.
              return false;
            default:
              break;
          }
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
