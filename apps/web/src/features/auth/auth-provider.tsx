import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { env } from '@/config/env';
import { configureApiClient } from '@/lib/api-client';
import { useAuthStore } from './auth-store';

/** Matches every key this app owns in `localStorage`. */
const AUTH_STORAGE_PREFIX = 'voiceflow.auth';

/**
 * Wires authentication into the app.
 *
 * The API client is configured during render rather than in an effect. React
 * runs child effects before parent effects, so a route's query could fire — and
 * find an unconfigured client — before an effect-based configuration landed.
 * Doing it synchronously removes that race.
 *
 * Persisted sessions need no help: the auth store restores itself at module
 * evaluation, so `RequireAuth` sees the correct status on the very first render.
 * `bootstrap` is re-run only for cross-tab changes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const bootstrap = useAuthStore((state) => state.bootstrap);

  configureApiClient({
    baseUrl: env.apiBaseUrl,
    timeoutMs: env.apiTimeoutMs,
    // Read through `getState` rather than a subscription: the client is a
    // module-level singleton and must see the current token at call time.
    getAccessToken: () => useAuthStore.getState().accessToken,
    onTokensRefreshed: (tokens) => useAuthStore.getState().setTokens(tokens),
    onUnauthorized: () => {
      useAuthStore.getState().signOut();
      // Drop cached data so the next user cannot see the previous session's
      // responses while the router redirects.
      queryClient.clear();
    },
  });

  // `storage` events only fire in *other* tabs, so this stops a tab that was
  // signed out elsewhere from continuing to render a protected page.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !event.key.startsWith(AUTH_STORAGE_PREFIX)) return;
      bootstrap();
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [bootstrap]);

  return <>{children}</>;
}
