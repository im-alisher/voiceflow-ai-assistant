/**
 * Secret-scrubbing helpers.
 *
 * Applied to every structured log payload so that a stray `console.log(request.body)`
 * can never leak a password, a token or a connection string into an aggregator.
 */

/** Object keys whose values are always replaced, regardless of nesting. */
const SENSITIVE_KEYS = new Set(
  [
    'password',
    'newpassword',
    'currentpassword',
    'confirmpassword',
    'passwordhash',
    'accesstoken',
    'refreshtoken',
    'token',
    'authorization',
    'cookie',
    'set-cookie',
    'secret',
    'clientsecret',
    'apikey',
    'api_key',
    'privatekey',
    'connectionstring',
    'dsn',
  ].map((key) => key.toLowerCase()),
);

export const REDACTED = '[REDACTED]';

/** Bearer/Basic values embedded in free text. */
const AUTH_HEADER_PATTERN = /\b(bearer|basic)\s+[\w\-._~+/=]+/gi;

/** `key=value` / `key: value` pairs for known secret names inside a string. */
const INLINE_SECRET_PATTERN =
  /\b(password|token|secret|apikey|api_key|access_token|refresh_token)\b\s*[=:]\s*"?[^"\s,;&]+"?/gi;

export function maskSecrets<T>(input: T, depth = 0): T {
  if (depth > 6 || input === null || input === undefined) return input;

  if (typeof input === 'string') {
    return input
      .replace(AUTH_HEADER_PATTERN, (_match, scheme: string) => `${scheme} ${REDACTED}`)
      .replace(INLINE_SECRET_PATTERN, (match, key: string) =>
        match.includes('=')
          ? `${key}=${REDACTED}`
          : match.includes(': ')
            ? `${key}: ${REDACTED}`
            : `${key}:${REDACTED}`,
      ) as T;
  }

  if (Array.isArray(input)) {
    // Narrowed to `unknown[]` first: `Array.isArray` on a generic widens the
    // element type to `any`, which would defeat the type checks below.
    const entries = input as unknown[];
    return entries.map((entry) => maskSecrets(entry, depth + 1)) as T;
  }

  if (input instanceof Date) return input;

  if (typeof input === 'object') {
    const source = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      output[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? REDACTED
        : maskSecrets(value, depth + 1);
    }
    return output as T;
  }
  return input;
}

export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
  readonly details?: unknown;
}

/** Normalises anything throwable into a loggable, secret-free object. */
export function serializeError(error: unknown, includeStack = true): SerializedError {
  if (!(error instanceof Error)) {
    return { name: 'NonError', message: maskSecrets(String(error)) };
  }

  const source = error as Error & { code?: unknown; details?: unknown };
  return {
    name: error.name,
    message: maskSecrets(error.message),
    ...(includeStack && error.stack ? { stack: error.stack } : {}),
    ...(typeof source.code === 'string' ? { code: source.code } : {}),
    ...(source.details !== undefined ? { details: maskSecrets(source.details) } : {}),
  };
}
