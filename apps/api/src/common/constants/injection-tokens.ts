/**
 * Injection tokens for providers behind an interface.
 *
 * Every token is a `Symbol` so a typo becomes a "no provider for token" boot
 * failure instead of an accidental `undefined` at runtime.
 */

export const AI_PROVIDER_REGISTRY = Symbol('AI_PROVIDER_REGISTRY');

/** Wall-clock access, injected so time-dependent logic stays testable. */
export const CLOCK = Symbol('CLOCK');

/** Random token/id generation, injected for deterministic tests. */
export const ID_GENERATOR = Symbol('ID_GENERATOR');

/** Password hashing port. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** Speech-to-text port (server-side fallback for browsers without support). */
export const SPEECH_TO_TEXT_PROVIDER = Symbol('SPEECH_TO_TEXT_PROVIDER');

/** Text-to-speech port. */
export const TEXT_TO_SPEECH_PROVIDER = Symbol('TEXT_TO_SPEECH_PROVIDER');

export const DI_TOKENS = {
  AI_PROVIDER_REGISTRY,
  CLOCK,
  ID_GENERATOR,
  PASSWORD_HASHER,
  SPEECH_TO_TEXT_PROVIDER,
  TEXT_TO_SPEECH_PROVIDER,
} as const;
