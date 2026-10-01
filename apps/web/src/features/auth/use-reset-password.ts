import { useMutation } from '@tanstack/react-query';
import { API_ROUTES } from '@voiceflow/shared';
import { api } from '@/lib/api-client';

/**
 * Redeems a reset token.
 *
 * Sent anonymously: the user who requested the reset may well have been signed
 * out, or may never have been signed in, so requiring a token here would defeat
 * the purpose of the flow. The API treats the token itself as the credential.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api.post<{ revokedSessions: number }>(API_ROUTES.auth.resetPassword, input, {
        anonymous: true,
      }),
  });
}

/**
 * Pulls the token out of the reset link.
 *
 * The token may arrive in the fragment (`#token=…`, preferred) or the query
 * string, because which one survives depends on the mail client and some of
 * them rewrite links. The fragment is preferred since a query-string token
 * leaks into `Referer` headers on navigation.
 */
export function readResetToken(search: string, hash: string): string | null {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  if (fromHash && fromHash.length > 0) return fromHash;

  const fromQuery = new URLSearchParams(search).get('token');
  return fromQuery && fromQuery.length > 0 ? fromQuery : null;
}
