import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth-store';
import { ROUTES } from '@/routes/paths';

/**
 * Gate for routes that require a session.
 *
 * The auth store bootstraps synchronously from `localStorage`, so the status is
 * already correct on the first render and no loading state is needed. If
 * restoration ever becomes asynchronous, `authenticating` is the state that
 * would need a spinner rather than a redirect.
 */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status !== 'authenticated') {
    return <Navigate to={ROUTES.login} replace state={{ from: safePath(location.pathname) }} />;
  }

  return <Outlet />;
}

/**
 * Gate for the sign-in and registration pages.
 *
 * Keeps an authenticated user out of the auth screens: without this, following
 * a stale `/login` bookmark would show a form that silently does nothing.
 */
export function RequireAnonymous() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'authenticated') {
    return <Navigate to={safePath(readRedirectTarget(location.state))} replace />;
  }

  return <Outlet />;
}

/** Only in-app absolute paths are ever used as a redirect destination. */
function safePath(pathname: string): string {
  return pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : ROUTES.dashboard;
}

function readRedirectTarget(state: unknown): string {
  if (typeof state !== 'object' || state === null) return ROUTES.dashboard;
  const from = (state as { from?: unknown }).from;
  return typeof from === 'string' ? from : ROUTES.dashboard;
}
