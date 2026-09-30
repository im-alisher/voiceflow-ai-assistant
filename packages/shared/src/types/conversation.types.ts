import type { ConversationStatus, MessageInputMode } from '../enums';
import type { MessageDto } from './message.types';

export interface ConversationDto {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly status: ConversationStatus;
  readonly model: string;
  readonly providerId: string;
  readonly systemPrompt: string | null;
  readonly messageCount: number;
  readonly lastMessagePreview: string | null;
  readonly lastMessageAt: string | null;
  readonly isPinned: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateConversationInput {
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

export interface ConversationPageQuery {
  readonly cursor?: string;
  readonly limit?: number;
  readonly status?: ConversationStatus;
  readonly search?: string;
  readonly sort?: ConversationSort;
}

export const CONVERSATION_SORTS = ['updated_at', 'created_at', 'title'] as const;

export type ConversationSort = (typeof CONVERSATION_SORTS)[number];

/** Conversation hydrated with its most recent turns for instant first paint. */
export interface ConversationWithMessages extends ConversationDto {
  readonly messages: readonly MessageDto[];
}

export interface ConversationSummary {
  readonly id: string;
  readonly title: string;
  readonly messageCount: number;
  readonly lastMessageAt: string | null;
  readonly lastInputMode: MessageInputMode | null;
}
