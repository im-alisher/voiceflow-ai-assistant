import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  API_ROUTES,
  loginSchema,
  registerSchema,
  type AuthSessionDto,
  type AuthUserDto,
  type LoginRequest,
  type RegisterRequest,
} from '@voiceflow/shared';
import { api } from '@/lib/api-client';
import { useAuthStore } from './auth-store';

/** Fields the sign-in form collects. */
export type LoginInput = LoginRequest;

/**
 * Fields the registration form collects.
 *
 * `acceptedTerms` is a plain `boolean` here even though `RegisterRequest` pins
 * it to `true`: the checkbox genuinely can be unchecked, and `registerSchema`
 * is what rejects that. Narrowing at the boundary keeps the form honest.
 */
export interface RegisterInput extends Omit<RegisterRequest, 'acceptedTerms' | 'displayName'> {
  readonly displayName: string;
  readonly acceptedTerms: boolean;
}

export interface ForgotPasswordResponse {
  readonly accepted: true;
}

export interface SessionSummary {
  readonly id: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly expiresAt: string;
  readonly isActive: boolean;
  readonly isCurrent: boolean;
}

/**
 * Sign-in.
 *
 * The payload is validated by the shared Zod schema before the request goes out,
 * so an obviously invalid form never costs a round trip and the client and
 * server agree on what "valid" means.
 */
export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<AuthSessionDto>(API_ROUTES.auth.login, loginSchema.parse(input), {
        anonymous: true,
      }),
    onSuccess: setSession,
  });
}

/** Account creation, which also signs the new user in. */
export function useRegister() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<AuthSessionDto>(API_ROUTES.auth.register, registerSchema.parse(input), {
        anonymous: true,
      }),
    onSuccess: setSession,
  });
}

/**
 * Sign-out.
 *
 * The local session is cleared unconditionally, even if the request fails: the
 * user asked to sign out, so the UI must reflect that immediately rather than
 * waiting on a network round trip.
 */
export function useLogout() {
  const signOut = useAuthStore((state) => state.signOut);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.post<void>(API_ROUTES.auth.logout),
    onSettled: () => {
      signOut();
      // Cached data belongs to the session that is ending; keeping it would let
      // the next person to sign in briefly see the previous one's data.
      queryClient.clear();
    },
  });

  const logout = useCallback(() => mutation.mutate(), [mutation]);

  return { ...mutation, logout };
}

/**
 * Password-reset request.
 *
 * The API answers identically whether or not the address exists, so this can
 * safely report success unconditionally.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api.post<ForgotPasswordResponse>(
        API_ROUTES.auth.forgotPassword,
        { email },
        { anonymous: true },
      ),
  });
}

/** Re-reads the profile, which also validates the stored token server-side. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthUserDto>(API_ROUTES.auth.me),
    // The profile changes rarely and is already in the store; refetching on
    // every mount would add a request to every page transition.
    staleTime: 5 * 60_000,
  });
}

/** Signed-in devices, so a session the user does not recognise can be revoked. */
export function useSessions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => api.get<SessionSummary[]>(API_ROUTES.auth.sessions),
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) => api.delete<void>(`${API_ROUTES.auth.sessions}/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });

  return { ...query, revoke };
}
