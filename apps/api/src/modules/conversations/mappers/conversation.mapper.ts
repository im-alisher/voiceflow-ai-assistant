import type { ConversationDto } from '@voiceflow/shared';
import type { Conversation } from '../entities/conversation.entity';

/** Entity -> transport mappers. Entities are never returned from a controller. */

/** Characters kept from the tail of a message for the sidebar preview. */
const PREVIEW_LENGTH = 120;

export function toConversationDto(conversation: Conversation): ConversationDto {
  return {
    id: conversation.id,
    userId: conversation.userId,
    title: conversation.title,
    status: conversation.status,
    model: conversation.model,
    providerId: conversation.providerId,
    systemPrompt: conversation.systemPrompt,
    messageCount: conversation.messageCount,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageAt: conversation.lastMessageAt ? conversation.lastMessageAt.toISOString() : null,
    isPinned: conversation.isPinned,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

/**
 * Builds the preview stored alongside a conversation.
 *
 * Collapsed to a single line and truncated from the *front* of the tail, so the
 * reader always sees how the message ends — which is the part that distinguishes
 * one turn from another at a glance.
 */
export function toMessagePreview(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= PREVIEW_LENGTH) return collapsed;
  return `…${collapsed.slice(-PREVIEW_LENGTH)}`;
}
