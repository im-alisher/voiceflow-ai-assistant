import { AUTH_STORAGE_KEY } from '@voiceflow/shared';

/** The subset of session state that is safe to write to `localStorage`. */
export interface PersistedAuthSession {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: string;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
}

/**
 * Reads the persisted session.
 *
 * Only non-secret identifiers and the short-lived access token are stored. The
 * refresh token is deliberately absent: the API keeps it in an `httpOnly`
 * cookie, so nothing sensitive is ever reachable from JavaScript.
 */
export function readPersistedSession(): PersistedAuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedAuthSession>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.accessTokenExpiresAt !== 'string'
    ) {
      // A corrupt or older payload is discarded rather than trusted.
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return parsed as PersistedAuthSession;
  } catch {
    // Storage can throw in private-mode Safari and when a quota is exceeded.
    return null;
  }
}

export function writePersistedSession(session: PersistedAuthSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A session that cannot be persisted still works for this tab.
  }
}

export function clearPersistedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Nothing to do: the in-memory session is cleared regardless.
  }
}

/** True when the stored access token has already expired. */
export function isAccessTokenExpired(session: PersistedAuthSession, skewSeconds = 30): boolean {
  const expiresAt = Date.parse(session.accessTokenExpiresAt);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt - skewSeconds * 1000 <= Date.now();
}
