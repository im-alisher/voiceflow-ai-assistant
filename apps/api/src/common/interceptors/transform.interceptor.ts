import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { REQUEST_ID_HEADER, type ResponseMeta } from '@voiceflow/shared';
import { Reflector } from '@nestjs/core';
import { type Observable, map } from 'rxjs';
import { SKIP_TRANSFORM_KEY } from '../decorators';
import type { AuthenticatedRequest } from '../interfaces';

/**
 * Wraps every non-streaming handler result in the `{ data, meta }` envelope.
 *
 * Centralising the envelope here means a controller can return a bare DTO and
 * still produce a uniform, documented response shape — and a handler that is
 * already in wire form (SSE, file download) can opt out via `@SkipTransform()`.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      map((data: T) => {
        // A handler may opt out by returning the envelope itself.
        if (isAlreadyEnveloped(data)) return data;

        const meta: ResponseMeta = {
          requestId: request.context?.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        };

        return { data, meta };
      }),
    );
  }
}

function isAlreadyEnveloped(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value &&
    Object.keys(value).length === 2
  );
}

export { REQUEST_ID_HEADER };
