/**
 * Roles a chat message can take part in.
 *
 * `system` messages are never persisted against a conversation — they are
 * synthesised at request time by the prompt service and are only echoed back
 * to the client for debugging when explicitly requested.
 */
export const MESSAGE_ROLES = ['system', 'user', 'assistant'] as const;

export type MessageRole = (typeof MESSAGE_ROLES)[number];

/** Roles that may be persisted on a `messages` row. */
export const PERSISTED_MESSAGE_ROLES = ['user', 'assistant'] as const;

export type PersistedMessageRole = (typeof PERSISTED_MESSAGE_ROLES)[number];
