import type { ApiErrorCode } from '../enums';

/** Uniform success envelope returned by every non-streaming endpoint. */
export interface ApiResponse<T> {
  readonly data: T;
  readonly meta?: ResponseMeta;
}

export interface ResponseMeta {
  readonly requestId: string;
  readonly timestamp: string;
}

/** Uniform failure envelope. Mirrored exactly by the API exception filter. */
export interface ApiErrorResponse {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details?: unknown;
    readonly path?: string;
    readonly timestamp: string;
    readonly requestId: string;
  };
}

/** Keyset/cursor pagination. Offsets are avoided to keep pages stable. */
export interface Paginated<T> {
  readonly items: readonly T[];
  readonly page: PageInfo;
}

export interface PageInfo {
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly limit: number;
  readonly total?: number;
}

/** Streamed completion frames, serialised as SSE `data:` lines. */
export type AgentStreamEvent =
  | {
      readonly type: 'meta';
      readonly conversationId: string;
      readonly model: string;
      readonly providerId: string;
    }
  | { readonly type: 'delta'; readonly delta: string }
  | { readonly type: 'turn'; readonly userMessageId: string; readonly assistantMessageId: string }
  | {
      readonly type: 'done';
      readonly finishReason: string;
      readonly tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
    }
  | { readonly type: 'error'; readonly code: ApiErrorCode; readonly message: string };

export const AGENT_STREAM_EVENT_TYPES = ['meta', 'delta', 'turn', 'done', 'error'] as const;

export type AgentStreamEventType = (typeof AGENT_STREAM_EVENT_TYPES)[number];
