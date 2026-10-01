import type { ConversationSort, ConversationStatus } from '@voiceflow/shared';

/** Deployment-wide fallbacks used when a conversation does not name a model. */
export interface ModelDefaults {
  readonly model: string;
  readonly providerId: string;
}

export interface CreateConversationInput {
  readonly userId: string;
  readonly title?: string;
  readonly model?: string;
  readonly providerId?: string;
  readonly systemPrompt?: string;
}

export interface UpdateConversationInput {
  readonly title?: string;
  readonly status?: ConversationStatus;
  readonly isPinned?: boolean;
}

export interface ListConversationsInput {
  readonly userId: string;
  readonly status?: ConversationStatus;
  readonly search?: string;
  readonly sort?: ConversationSort;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AppendMessageInput {
  readonly conversationId: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly inputMode: 'text' | 'voice';
  readonly clientMessageId?: string;
  readonly model?: string;
  readonly providerId?: string;
  readonly tokenCount?: number;
  readonly latencyMs?: number;
  readonly confidence?: number | null;
}

export interface ListMessagesInput {
  readonly conversationId: string;
  readonly limit: number;
  readonly order: 'asc' | 'desc';
  readonly cursor?: string;
}
