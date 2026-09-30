import { Injectable, type NestMiddleware } from '@nestjs/common';
import { REQUEST_ID_HEADER } from '@voiceflow/shared';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest, RequestContext } from '../interfaces';

/**
 * Establishes the per-request correlation context.
 *
 * Registered before every guard, so the request id is available to the throttle
 * and auth layers as well as to logging and the response envelope. A client may
 * supply its own id via `X-Request-Id`, which makes a request traceable across
 * the browser console, the API logs, and any downstream service.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.get(REQUEST_ID_HEADER);
    // A client-supplied id is echoed back but not trusted for anything else;
    // it is length-bounded so a hostile client cannot bloat every log line.
    const requestId =
      typeof supplied === 'string' && supplied.length > 0 && supplied.length <= 128
        ? supplied
        : randomUUID();

    const context: RequestContext = {
      requestId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
      startedAt: Date.now(),
    };

    (request as AuthenticatedRequest).context = context;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
