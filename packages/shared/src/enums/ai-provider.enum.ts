/**
 * Concrete AI backends the orchestrator can delegate to.
 *
 * Only `mock` is implemented in this repository. The remaining identifiers are
 * reserved so that adding a paid provider later is a registration-only change
 * and never a refactor of the call sites.
 */
export const AI_PROVIDER_IDS = ['mock', 'openai', 'anthropic', 'ollama'] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

/** Identifiers that are safe to run with zero credentials. */
export const BUILT_IN_AI_PROVIDER_IDS = ['mock'] as const;

export type BuiltInAiProviderId = (typeof BUILT_IN_AI_PROVIDER_IDS)[number];
