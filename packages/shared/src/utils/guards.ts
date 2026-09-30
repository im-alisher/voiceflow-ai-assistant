import {
  AI_PROVIDER_IDS,
  API_ERROR_CODES,
  CONVERSATION_STATUSES,
  FONT_SCALES,
  MESSAGE_INPUT_MODES,
  MESSAGE_ROLES,
  THEME_MODES,
  USER_ROLES,
} from '../enums';

/** Narrows an arbitrary value to a member of a `readonly string[]` union. */
export function isMemberOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export const isMessageRole = (value: unknown): value is (typeof MESSAGE_ROLES)[number] =>
  isMemberOf(MESSAGE_ROLES, value);

export const isConversationStatus = (
  value: unknown,
): value is (typeof CONVERSATION_STATUSES)[number] => isMemberOf(CONVERSATION_STATUSES, value);

export const isAiProviderId = (value: unknown): value is (typeof AI_PROVIDER_IDS)[number] =>
  isMemberOf(AI_PROVIDER_IDS, value);

export const isThemeMode = (value: unknown): value is (typeof THEME_MODES)[number] =>
  isMemberOf(THEME_MODES, value);

export const isFontScale = (value: unknown): value is (typeof FONT_SCALES)[number] =>
  isMemberOf(FONT_SCALES, value);

export const isMessageInputMode = (value: unknown): value is (typeof MESSAGE_INPUT_MODES)[number] =>
  isMemberOf(MESSAGE_INPUT_MODES, value);

export const isUserRole = (value: unknown): value is (typeof USER_ROLES)[number] =>
  isMemberOf(USER_ROLES, value);

export const isApiErrorCode = (value: unknown): value is (typeof API_ERROR_CODES)[number] =>
  isMemberOf(API_ERROR_CODES, value);
