/**
 * Lifecycle of a conversation thread.
 *
 * - `active`   — open thread, accepts new turns
 * - `archived` — read-only, hidden from the default listing
 * - `deleted`  — soft-deleted, retained for a grace period before purge
 */
export const CONVERSATION_STATUSES = ['active', 'archived', 'deleted'] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
