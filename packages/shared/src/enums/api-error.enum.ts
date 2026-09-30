/**
 * Canonical, machine-readable error identifiers.
 *
 * The API emits these in `ApiError.code`; the web client branches on them for
 * transport-level concerns (refresh on `TOKEN_EXPIRED`, toast on `CONFLICT`, …)
 * and never on human-readable messages.
 */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'GONE',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'TOO_MANY_REQUESTS',
  'INTERNAL_SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
  'AI_PROVIDER_ERROR',
  'AI_PROVIDER_TIMEOUT',
  'AI_CONTEXT_OVERFLOW',
  'AI_NOT_CONFIGURED',
  'VOICE_TRANSCRIPTION_FAILED',
  'VOICE_SYNTHESIS_FAILED',
  'NETWORK_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** HTTP status associated with each canonical code. */
export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  VALIDATION_ERROR: 422,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  AI_PROVIDER_ERROR: 502,
  AI_PROVIDER_TIMEOUT: 504,
  AI_CONTEXT_OVERFLOW: 413,
  AI_NOT_CONFIGURED: 503,
  VOICE_TRANSCRIPTION_FAILED: 502,
  VOICE_SYNTHESIS_FAILED: 502,
  NETWORK_ERROR: 0,
} satisfies Record<ApiErrorCode, number>;
