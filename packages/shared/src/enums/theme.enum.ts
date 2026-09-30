/** User-selectable colour schemes. */
export const THEME_MODES = ['light', 'dark', 'system'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** Themes actually applied to the document once `system` is resolved. */
export const RESOLVED_THEMES = ['light', 'dark'] as const;

export type ResolvedTheme = (typeof RESOLVED_THEMES)[number];

/** Readability font scale options offered in settings. */
export const FONT_SCALES = ['sm', 'base', 'lg', 'xl'] as const;

export type FontScale = (typeof FONT_SCALES)[number];
