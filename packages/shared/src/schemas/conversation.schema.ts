import { z } from 'zod';
import { CONVERSATION_STATUSES } from '../enums';
import { CONVERSATION_SORTS } from '../types/conversation.types';
import { paginationQuerySchema } from './common.schema';

export const conversationTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title cannot be empty')
  .max(120, 'Title must not exceed 120 characters');

export const systemPromptSchema = z
  .string()
  .trim()
  .max(4000, 'System prompt must not exceed 4000 characters');

export const createConversationSchema = z.object({
  title: conversationTitleSchema.optional(),
  model: z.string().trim().min(1).max(120).optional(),
  providerId: z.string().trim().min(1).max(60).optional(),
  systemPrompt: systemPromptSchema.optional(),
});

export const updateConversationSchema = z
  .object({
    title: conversationTitleSchema.optional(),
    status: z.enum(CONVERSATION_STATUSES).optional(),
    isPinned: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const listConversationsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(CONVERSATION_STATUSES).default('active'),
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(CONVERSATION_SORTS).default('updated_at'),
});

export type CreateConversationRequest = z.infer<typeof createConversationSchema>;
export type UpdateConversationRequest = z.infer<typeof updateConversationSchema>;
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
