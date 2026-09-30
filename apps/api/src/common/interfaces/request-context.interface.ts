import type { UserRole } from '@voiceflow/shared';
import type { Request } from 'express';

/** The verified caller, attached to the request by `JwtStrategy`. */
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  /** Opaque id of the refresh session this access token was minted for. */
  readonly sessionId: string;
}

/** Per-request data propagated to services and log lines. */
export interface RequestContext {
  readonly requestId: string;
  readonly userId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly startedAt: number;
}

/**
 * Express request augmented by the correlation middleware and the auth guard.
 *
 * Extends the real `Request` rather than restating a few fields, so handlers and
 * cross-cutting code can reach `method`, `originalUrl`, `cookies`, and `ip`
 * without further casts.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedPrincipal;
  context?: RequestContext;
}
