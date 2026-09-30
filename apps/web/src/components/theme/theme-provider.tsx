import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { THEME_STORAGE_KEY } from '@voiceflow/shared';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** What the user chose, including `system`. */
  theme: ThemeMode;
  /** What is actually rendered, with `system` already collapsed to a value. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

/**
 * Theme state for the whole app.
 *
 * The very first paint is handled by the inline script in `index.html`, which
 * reads the same `THEME_STORAGE_KEY` before React mounts so there is no flash
 * of the wrong palette. This provider then owns the class on `<html>` and keeps
 * `color-scheme` in sync so native controls and scrollbars match.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);

  // `system` must follow the OS while the tab stays open, otherwise a user who
  // flips their desktop appearance would keep the stale palette until reload.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) =>
      setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
