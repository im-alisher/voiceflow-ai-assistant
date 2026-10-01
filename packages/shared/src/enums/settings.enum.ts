/**
 * Settings sections.
 *
 * Shared with the API so both runtimes agree on the set of navigable sections;
 * the web app uses this list to build its sidebar and the URL space
 * (`/settings/<section>`), which keeps a deep link stable if labels change.
 */
export const SETTINGS_SECTIONS = [
  'general',
  'appearance',
  'voice',
  'ai',
  'notifications',
  'accessibility',
  'account',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}
