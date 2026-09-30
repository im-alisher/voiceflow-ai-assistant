/**
 * Compile-time application identity.
 *
 * Anything that depends on a build-time constant (analytics, cache keys,
 * document titles) imports it from here rather than reading `process.env`
 * directly, so a missing env var can never reach production.
 */
export const APP_CONFIG = {
  name: 'Voiceflow',
  shortName: 'VF',
  version: '0.1.0',
  apiVersion: '1',
  supportEmail: 'support@voiceflow.local',
  description: 'Voice-first AI assistant platform.',
} as const;

export type AppConfig = typeof APP_CONFIG;

/** Namespaces used to group log lines emitted by the API. */
export const LOG_NAMESPACES = [
  'Application',
  'Http',
  'Auth',
  'Users',
  'Conversations',
  'Ai',
  'Voice',
  'Database',
  'Exception',
  'Validation',
] as const;

export type LogNamespace = (typeof LOG_NAMESPACES)[number];
