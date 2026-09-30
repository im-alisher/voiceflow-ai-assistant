/**
 * Runtime feature switches.
 *
 * These are *build-time* switches for optional product surfaces only. Anything
 * that changes behaviour based on user data belongs in `UserPreferencesDto`
 * instead, so it can be changed without a redeploy.
 */
export const FEATURE_FLAGS = {
  /** Exposes the agent orchestration playground in the UI. */
  aiOrchestrationPlayground: false,
  /** Shows a diagnostics panel with provider latency/token metrics. */
  aiDiagnosticsPanel: true,
  /** Enables the push-to-talk keyboard shortcut. */
  voicePushToTalk: true,
  /** Enables SSE streaming; falls back to buffered responses when false. */
  streamingResponses: true,
  /** Renders the README placeholder gallery in the docs site. */
  documentationScreenshots: true,
} as const;

export type FeatureFlags = typeof FEATURE_FLAGS;
export type FeatureFlagName = keyof FeatureFlags;
