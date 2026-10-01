import type { MessageDto } from '@voiceflow/shared';
import type { Message } from '../entities/message.entity';

export function toMessageDto(message: Message): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    inputMode: message.inputMode,
    sequence: message.sequence,
    confidence: message.confidence,
    tokenCount: message.tokenCount,
    model: message.model,
    providerId: message.providerId,
    latencyMs: message.latencyMs,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}
