import { create } from 'zustand';
import type { AuthSessionDto, AuthUserDto } from '@voiceflow/shared';
import {
  clearPersistedSession,
  isAccessTokenExpired,
  readPersistedSession,
  writePersistedSession,
  type PersistedAuthSession,
} from './auth-storage';

export type AuthStatus = 'anonymous' | 'authenticating' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUserDto | null;
  accessToken: string | null;
  /** Set when sign-in succeeded but the profile could not be re-read. */
  error: string | null;

  /** Re-reads storage, e.g. after another tab signed out. */
  bootstrap: () => void;
  /** Records a fresh session from the API and persists its non-secret parts. */
  setSession: (session: AuthSessionDto) => void;
  /** Updates only the token pair, e.g. after a silent refresh. */
  setTokens: (tokens: AuthSessionDto['tokens']) => void;
  signOut: () => void;
  /** Marks a transient failure without discarding the current session. */
  setError: (message: string | null) => void;
}

type RestoredState = Pick<AuthState, 'status' | 'user' | 'accessToken'>;

/**
 * Reads the persisted session and turns it into initial state.
 *
 * Runs synchronously at module evaluation, not in an effect. Restoration has to
 * complete *before* the first render: `RequireAuth` redirects on a non-
 * authenticated status, so deferring it by one tick would throw an
 * already-signed-in user at the login page on every reload, then immediately
 * bounce them back.
 */
function restore(): RestoredState {
  const persisted = readPersistedSession();

  if (!persisted || isAccessTokenExpired(persisted)) {
    // An expired access token cannot be repaired from storage alone; clearing it
    // keeps a stale credential from being retried on the next request.
    clearPersistedSession();
    return { status: 'anonymous', user: null, accessToken: null };
  }

  return {
    status: 'authenticated',
    accessToken: persisted.accessToken,
    user: {
      id: persisted.userId,
      email: persisted.email,
      displayName: persisted.displayName,
      role: persisted.role as AuthUserDto['role'],
    },
  };
}

const ANONYMOUS: RestoredState = { status: 'anonymous', user: null, accessToken: null };

/**
 * Authentication state.
 *
 * Deliberately *not* wrapped in `persist`: the storage format is written and
 * validated by hand in `auth-storage.ts`, because the access token must be
 * paired with its expiry and a malformed payload has to be rejected rather than
 * hydrated into the UI.
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  ...restore(),
  error: null,

  bootstrap: () => set(restore()),

  setSession: (session) => {
    const persisted: PersistedAuthSession = {
      userId: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      role: session.user.role,
      accessToken: session.tokens.accessToken,
      accessTokenExpiresAt: session.tokens.accessTokenExpiresAt,
    };

    writePersistedSession(persisted);
    set({
      status: 'authenticated',
      user: session.user,
      accessToken: session.tokens.accessToken,
      error: null,
    });
  },

  setTokens: (tokens) => {
    const current = get().user;
    if (!current) return;

    writePersistedSession({
      userId: current.id,
      email: current.email,
      displayName: current.displayName,
      role: current.role,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    });

    set({ accessToken: tokens.accessToken, error: null });
  },

  signOut: () => {
    clearPersistedSession();
    set({ ...ANONYMOUS, error: null });
  },

  setError: (message) => set({ error: message }),
}));
