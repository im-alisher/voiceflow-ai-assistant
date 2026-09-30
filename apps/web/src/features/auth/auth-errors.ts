import { ApiError, NetworkError } from '@/lib/api-client';

/**
 * Normalises any thrown value into a message worth showing a user.
 *
 * Kept out of the form components so those files export only components, which
 * is what makes React Fast Refresh work correctly during development.
 *
 * Zod issues arrive as a plain `ZodError` because forms validate before
 * submitting, so the first issue becomes the message rather than surfacing as an
 * unhandled rejection with an opaque name.
 */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof NetworkError) return error.message;

  if (error instanceof Error) {
    if (error.name === 'ZodError') {
      const issues = (error as unknown as { issues?: { message: string }[] }).issues;
      return issues?.[0]?.message ?? 'Please check the form and try again';
    }
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
