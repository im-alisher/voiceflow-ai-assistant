/**
 * Hard limits enforced in the browser, in the API validation pipe and in the
 * database. Keeping them here means the three layers cannot disagree.
 */
export const LIMITS = {
  /** Maximum characters in a single user or assistant message. */
  MESSAGE_MAX_LENGTH: 8000,
  /** Maximum characters in a conversation title. */
  CONVERSATION_TITLE_MAX_LENGTH: 120,
  /** Maximum characters in a per-conversation system prompt. */
  SYSTEM_PROMPT_MAX_LENGTH: 4000,
  /** Maximum characters in a user display name. */
  DISPLAY_NAME_MAX_LENGTH: 64,
  /** Minimum password length. */
  PASSWORD_MIN_LENGTH: 10,
  PASSWORD_MAX_LENGTH: 128,
  /** Maximum page size for any paginated endpoint. */
  PAGE_SIZE_MAX: 100,
  PAGE_SIZE_DEFAULT: 25,
  /** Page size used for the initial conversation bootstrap. */
  RECENT_MESSAGE_PAGE_SIZE: 30,
  /** Turn history window considered when building model context. */
  CONTEXT_TURNS_DEFAULT: 20,
  CONTEXT_TURNS_MAX: 100,
  /** Audio capture guard rails. */
  SPEECH_MAX_DURATION_MS: 120_000,
  SPEECH_SILENCE_TIMEOUT_MS: 2500,
  /** Text handed to a single synthesis call. */
  SYNTHESIS_MAX_LENGTH: 4000,
  /** Upload cap for the optional server-side transcription route. */
  AUDIO_UPLOAD_MAX_BYTES: 8 * 1024 * 1024,
} as const;

/** Access-token / refresh-token defaults. */
export const TOKEN_DEFAULTS = {
  ACCESS_TTL_SECONDS: 60 * 15,
  REFRESH_TTL_SECONDS: 60 * 60 * 24 * 7,
  REFRESH_TTL_REMEMBER_SECONDS: 60 * 60 * 24 * 30,
  /** Clock skew tolerated when validating expiry. */
  LEEWAY_SECONDS: 5,
} as const;
