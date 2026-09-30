import { z } from 'zod';
import { MESSAGE_INPUT_MODES } from '../enums';
import { paginationQuerySchema, sortOrderSchema, uuidSchema } from './common.schema';

export const messageContentSchema = z
  .string()
  .trim()
  .min(1, 'Message cannot be empty')
  .max(8000, 'Message must not exceed 8000 characters');

export const clientMessageIdSchema = z.string().trim().min(8).max(120);

export const sendMessageSchema = z.object({
  content: messageContentSchema,
  inputMode: z.enum(MESSAGE_INPUT_MODES).default('text'),
  clientMessageId: clientMessageIdSchema.optional(),
  /**
   * When true the API returns the assistant reply as an SSE stream.
   * Ignored by the buffered path.
   */
  stream: z.boolean().default(false),
});

export const listMessagesQuerySchema = paginationQuerySchema.extend({
  conversationId: uuidSchema,
  order: sortOrderSchema,
});

export const deleteMessageSchema = z.object({
  conversationId: uuidSchema.optional(),
});

export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
