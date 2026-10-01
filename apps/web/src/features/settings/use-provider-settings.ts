import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { API_ROUTES, type AiProviderId } from '@voiceflow/shared';
import { api } from '@/lib/api-client';

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post<{ revokedSessions: number }>(API_ROUTES.auth.changePassword, input),
    onSuccess: (result) => {
      toast.success(
        result.revokedSessions > 0
          ? `Password changed. ${result.revokedSessions} other session(s) signed out.`
          : 'Password changed.',
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Password could not be changed');
    },
  });
}

export interface ProviderOption {
  readonly id: AiProviderId;
  readonly displayName: string;
  readonly available: boolean;
  readonly defaultModel: string;
}

/**
 * Registered AI providers.
 *
 * The endpoint is public so the settings page can render the picker before the
 * profile has loaded; it exposes capability metadata only, never credentials.
 */
export function useProviderOptions() {
  return useQuery({
    queryKey: ['ai', 'providers'],
    queryFn: () => api.get<readonly ProviderOption[]>(API_ROUTES.ai.providers),
    staleTime: 5 * 60_000,
  });
}
