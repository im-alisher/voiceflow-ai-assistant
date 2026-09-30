import { QueryClient } from '@tanstack/react-query';
import type { ApiErrorCode } from '@voiceflow/shared';
import { env } from '@/config/env';

/** Thrown by the API client so callers can branch on a canonical error code. */
export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  get isUnauthorized(): boolean {
    return this.code === 'UNAUTHORIZED' || this.code === 'TOKEN_EXPIRED';
  }

  get isValidation(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  get isConflict(): boolean {
    return this.code === 'CONFLICT';
  }
}

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
        if (error instanceof ApiClientError) {
          if (
            error.code === 'VALIDATION_ERROR' ||
            error.code === 'UNAUTHORIZED' ||
            error.code === 'FORBIDDEN' ||
            error.code === 'NOT_FOUND' ||
            error.code === 'CONFLICT' ||
            error.code === 'TOO_MANY_REQUESTS'
          ) {
            return false;
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

/** Absolute URL for an API path, honouring the configured base URL. */
export function apiUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${env.apiBaseUrl}${normalised}`;
}
