import { HttpException } from '@nestjs/common';
import { API_ERROR_STATUS, type ApiErrorCode } from '@voiceflow/shared';

export interface AppExceptionBody {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * Base class for every error the application raises deliberately.
 *
 * Carrying a canonical `ApiErrorCode` (rather than a bare HTTP status) means
 * clients branch on stable semantics, and adding a new failure mode never
 * requires the web client to guess. The global exception filter added later
 * turns this body into the wire format.
 */
export class AppException extends HttpException {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    const body: AppExceptionBody = { code, message, ...(details !== undefined ? { details } : {}) };
    super(body, API_ERROR_STATUS[code]);
    this.code = code;
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }

  static badRequest(message = 'Bad request', details?: unknown): AppException {
    return new AppException('BAD_REQUEST', message, details);
  }

  static unprocessable(message = 'Validation failed', details?: unknown): AppException {
    return new AppException('VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required', details?: unknown): AppException {
    return new AppException('UNAUTHORIZED', message, details);
  }

  static forbidden(message = 'You do not have access to this resource', details?: unknown): AppException {
    return new AppException('FORBIDDEN', message, details);
  }

  static notFound(resource = 'Resource', details?: unknown): AppException {
    return new AppException('NOT_FOUND', `${resource} was not found`, details);
  }

  static conflict(message = 'Resource already exists', details?: unknown): AppException {
    return new AppException('CONFLICT', message, details);
  }

  static gone(message = 'Resource is no longer available', details?: unknown): AppException {
    return new AppException('GONE', message, details);
  }

  static tooManyRequests(message = 'Too many requests', details?: unknown): AppException {
    return new AppException('TOO_MANY_REQUESTS', message, details);
  }

  static internal(message = 'Internal server error', details?: unknown): AppException {
    return new AppException('INTERNAL_SERVER_ERROR', message, details);
  }

  static serviceUnavailable(message = 'Service unavailable', details?: unknown): AppException {
    return new AppException('SERVICE_UNAVAILABLE', message, details);
  }
}
