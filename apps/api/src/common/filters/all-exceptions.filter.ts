import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { type ApiErrorCode } from '@voiceflow/shared';
import type { Response } from 'express';
import { AppException } from '../errors';
import type { AuthenticatedRequest } from '../interfaces';

/**
 * Widened once so comparisons below are `number`-to-`number`.
 *
 * `HttpStatus` members are enum-typed, and comparing them directly against the
 * `number` status an `HttpException` reports trips the enum-comparison lint rule.
 */
const INTERNAL_SERVER_ERROR: number = HttpStatus.INTERNAL_SERVER_ERROR;
const TOO_MANY_REQUESTS: number = HttpStatus.TOO_MANY_REQUESTS;

/**
 * Maps every thrown value onto the documented error envelope.
 *
 * Registered globally so a client never has to handle two error shapes. Errors
 * raised by NestJS and `ValidationPipe` are translated into canonical codes
 * rather than passed through, which lets the web client branch on `code` alone.
 *
 * Anything *not* recognised is reported as a generic 500: the real cause is
 * logged, never returned, so a stack trace or SQL fragment cannot leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = request.context?.requestId ?? 'unknown';

    const { status, code, message, details } = normalise(exception);

    if (status >= INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status} ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.originalUrl} -> ${status} ${code}: ${message}`);
    }

    response.status(status).json({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
}

interface NormalisedError {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

function normalise(exception: unknown): NormalisedError {
  if (exception instanceof AppException) {
    const body = exception.getResponse() as { details?: unknown };
    return {
      status: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      details: body.details,
    };
  }

  if (exception instanceof ThrottlerException) {
    return {
      status: TOO_MANY_REQUESTS,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down and try again shortly.',
    };
  }

  if (exception instanceof HttpException) {
    return fromNestHttpException(exception);
  }

  return {
    status: INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    // Deliberately opaque; the real cause has already been logged above.
    message: 'An unexpected error occurred',
  };
}

function fromNestHttpException(exception: HttpException): NormalisedError {
  const status = exception.getStatus();
  const payload = exception.getResponse();

  if (typeof payload === 'string') {
    return { status, code: codeForStatus(status), message: payload };
  }

  const { message } = payload as { message?: unknown };

  return {
    status,
    code: codeForStatus(status),
    message: Array.isArray(message)
      ? // `ValidationPipe` emits one entry per failed constraint.
        message.join('; ')
      : typeof message === 'string'
        ? message
        : defaultMessageFor(status),
  };
}

/**
 * Reverse lookup for framework-generated statuses.
 *
 * Several codes share a status (`UNAUTHORIZED`/`TOKEN_EXPIRED`), so the
 * ambiguous ones resolve to the generic code; the specific code is only ever
 * set explicitly by `AppException`.
 *
 * Keyed by plain numbers rather than `HttpStatus` members so the comparison is
 * a `number`-to-`number` lookup instead of a cross-enum comparison.
 */
const CODE_BY_STATUS: Readonly<Record<number, ApiErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_ERROR',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

const DEFAULT_MESSAGE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'Bad request',
  401: 'A valid access token is required',
  403: 'You do not have access to this resource',
  404: 'Resource was not found',
};

function codeForStatus(status: number): ApiErrorCode {
  return CODE_BY_STATUS[status] ?? 'INTERNAL_SERVER_ERROR';
}

function defaultMessageFor(status: number): string {
  return DEFAULT_MESSAGE_BY_STATUS[status] ?? 'Request failed';
}
