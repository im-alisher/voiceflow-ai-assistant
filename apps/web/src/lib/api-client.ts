import {
  API_ERROR_STATUS,
  API_ROUTES,
  type ApiErrorCode,
  type AuthSessionDto,
  type AuthTokensDto,
} from '@voiceflow/shared';
import { env } from '@/config/env';

/** Canonical failure surfaced to callers, carrying the server's error code. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
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

export class NetworkError extends Error {
  constructor(message = 'Unable to reach the server') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skips the Authorization header, e.g. for the login request itself. */
  anonymous?: boolean;
  /** Prevents an infinite refresh loop when the refresh call itself 401s. */
  isRetry?: boolean;
  signal?: AbortSignal;
}

/** Supplies the current access token, or `null` when signed out. */
export type AccessTokenProvider = () => string | null;

/** Performs a silent refresh; returns true when a new token is available. */
export type RefreshHandler = () => Promise<boolean>;

/** Called once when refresh fails and the session has been discarded. */
export type UnauthorizedHandler = () => void;

interface ApiClientConfig {
  baseUrl: string;
  timeoutMs: number;
  getAccessToken: AccessTokenProvider;
  /** Stores the tokens returned by a successful silent refresh. */
  onTokensRefreshed: (tokens: AuthTokensDto) => void;
  /** Called once when refresh fails and the session has been discarded. */
  onUnauthorized: UnauthorizedHandler;
}

let config: ApiClientConfig | null = null;
let refreshInFlight: Promise<boolean> | null = null;

/** Wires the client to the auth store exactly once, at app start-up. */
export function configureApiClient(next: ApiClientConfig): void {
  config = next;
  refreshInFlight = null;
}

/**
 * Single-flight silent refresh.
 *
 * Several requests can expire at the same moment. Without deduplication each
 * would independently call `/auth/refresh`, and because refresh tokens rotate,
 * the second call would present an already-used token — which the API treats as
 * theft and answers by revoking the whole session. One shared promise prevents
 * that entirely.
 */
async function refreshOnce(): Promise<boolean> {
  if (!config) return false;

  refreshInFlight ??= (async () => {
    try {
      const envelope = await rawRequest(`${config!.baseUrl}${API_ROUTES.auth.refresh}`, {
        method: 'POST',
        body: {},
        anonymous: true,
      });
      // `/auth/refresh` answers with a whole session, not a bare token pair, so
      // the tokens have to be taken from `.tokens` explicitly.
      const session = extractData<AuthSessionDto>(envelope);
      config!.onTokensRefreshed(session.tokens);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Reads the `{ data, meta }` envelope, tolerating a bare body. */
function extractData<T>(envelope: unknown): T {
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return (envelope as { data: T }).data;
  }
  return envelope as T;
}

async function rawRequest(url: string, options: RequestOptions): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Api-Version': '1',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!options.anonymous) {
    const token = config?.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // A caller-provided signal and an internal timeout are merged rather than
  // raced, so aborting one does not leave the other dangling.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    config?.timeoutMs ?? env.apiTimeoutMs,
  );

  const signal = options.signal
    ? mergeSignals(options.signal, timeoutController.signal)
    : timeoutController.signal;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new NetworkError();
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 204) return null;

  const payload = await safeJson(response);

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return payload;
}

/**
 * Builds an `ApiError` from a non-2xx response.
 *
 * Exported so the streaming client, which cannot go through `rawRequest`,
 * still reports failures in the same canonical shape.
 */
export function toApiError(status: number, payload: unknown): ApiError {
  const body = payload as { code?: ApiErrorCode; message?: string; details?: unknown } | null;

  const code =
    body?.code && Object.prototype.hasOwnProperty.call(API_ERROR_STATUS, body.code)
      ? body.code
      : inferCode(status);

  return new ApiError(code, body?.message ?? defaultMessage(code), status, body?.details);
}

/** Reverse lookup used when the response body is not the canonical shape. */
function inferCode(status: number): ApiErrorCode {
  for (const [code, mapped] of Object.entries(API_ERROR_STATUS)) {
    if (mapped === status && code !== 'TOKEN_EXPIRED') return code as ApiErrorCode;
  }
  return 'INTERNAL_SERVER_ERROR';
}

function defaultMessage(code: ApiErrorCode): string {
  if (code === 'UNAUTHORIZED') return 'Please sign in to continue';
  if (code === 'FORBIDDEN') return 'You do not have access to this resource';
  if (code === 'NOT_FOUND') return 'That resource could not be found';
  if (code === 'CONFLICT') return 'That action conflicts with existing data';
  if (code === 'TOO_MANY_REQUESTS') return 'Too many requests. Please try again shortly';
  if (code === 'NETWORK_ERROR') return 'Unable to reach the server';
  return 'Something went wrong';
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // A proxy error page or an empty 502 body: nothing structured to read.
    return null;
  }
}

/** Combines two signals; either aborting aborts the request. */
function mergeSignals(primary: AbortSignal, secondary: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (primary.aborted || secondary.aborted) {
    controller.abort();
  } else {
    primary.addEventListener('abort', abort, { once: true });
    secondary.addEventListener('abort', abort, { once: true });
  }
  return controller.signal;
}

/**
 * Issues an API request, refreshing the access token once on expiry.
 *
 * Returns the unwrapped `data` payload; the `meta` envelope is transport
 * detail the UI rarely needs.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!config) {
    throw new Error('configureApiClient() must be called before making requests');
  }

  const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const envelope = await rawRequest(url, options);
    return extractData<T>(envelope);
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      !error.isUnauthorized ||
      options.anonymous ||
      options.isRetry
    ) {
      throw error;
    }

    // Refresh failed or was impossible: the session is gone, so clear it and let
    // the router send the user to the sign-in page.
    if (!(await refreshOnce())) {
      config.onUnauthorized();
      throw error;
    }

    const envelope = await rawRequest(url, { ...options, isRetry: true });
    return extractData<T>(envelope);
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
