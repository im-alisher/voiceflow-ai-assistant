import type { ApiErrorCode } from '../enums';

/** Canonical error shape used by every layer, including the AI provider port. */
export interface AppError {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: unknown;
  readonly cause?: unknown;
}

/**
 * Explicit success/failure union.
 *
 * Provider ports return `Result` instead of throwing so that a transient
 * backend outage is a value the orchestrator can fall back from, not an
 * exception that unwinds a stream that has already started streaming bytes to
 * the client.
 */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/** Unwraps a result, throwing when it holds an error. Use at the edges only. */
export function unwrapOrThrow<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error
    ? result.error
    : Object.assign(new Error((result.error as AppError).message), result.error);
}

/** Maps the success value, preserving any error unchanged. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}
