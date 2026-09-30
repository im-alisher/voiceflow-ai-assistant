import type { MessageInputMode, MessageRole } from '../enums';

/** A message exactly as persisted and returned by the API. */
export interface MessageDto {
  readonly id: string;
  readonly conversationId: string;
  readonly role: Exclude<MessageRole, 'system'>;
  readonly content: string;
  readonly inputMode: MessageInputMode;
  readonly sequence: number;
  /** 0–1 classifier confidence; `null` for user turns and mock providers. */
  readonly confidence: number | null;
  readonly tokenCount: number;
  readonly model: string | null;
  readonly providerId: string | null;
  readonly latencyMs: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateMessageInput {
  readonly content: string;
  readonly inputMode?: MessageInputMode;
  /** Client-side idempotency key; replays are de-duplicated server-side. */
  readonly clientMessageId?: string;
}

export interface MessagePageQuery {
  readonly conversationId: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly order?: 'asc' | 'desc';
}

/** A user turn plus the assistant turn it produced, as one atomic exchange. */
export interface TurnDto {
  readonly userMessage: MessageDto;
  readonly assistantMessage: MessageDto;
}
