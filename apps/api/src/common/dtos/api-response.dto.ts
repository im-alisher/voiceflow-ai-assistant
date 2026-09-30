import type { ApiErrorCode, ResponseMeta } from '@voiceflow/shared';

/** Success envelope returned by every non-streaming endpoint. */
export class ApiResponseDto<T> {
  readonly data: T;
  readonly meta?: ResponseMeta;

  private constructor(data: T, meta?: ResponseMeta) {
    this.data = data;
    this.meta = meta;
  }

  static ok<T>(data: T, meta?: ResponseMeta): ApiResponseDto<T> {
    return new ApiResponseDto(data, meta);
  }
}

/** Wire representation of a deliberate failure. */
export class ApiErrorDto {
  readonly code!: ApiErrorCode;
  readonly message!: string;
  readonly details?: unknown;
  readonly path?: string;
  readonly timestamp!: string;
  readonly requestId!: string;
}
