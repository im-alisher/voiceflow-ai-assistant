import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { API_ROUTES, type UpdatePreferencesRequest, type UserDto } from '@voiceflow/shared';
import { api } from '@/lib/api-client';

export const profileKeys = {
  me: ['users', 'me'] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: () => api.get<UserDto>(API_ROUTES.users.profile),
    staleTime: 60_000,
  });
}

/**
 * Preference patch.
 *
 * Optimistic: the theme and font-scale controls must feel instant, and a
 * rollback on failure is far less noticeable than a spinner on every slider
 * tick. The cache is updated with the server's response rather than the
 * optimistic value, so a rejected write cannot leave the UI claiming a setting
 * that was not saved.
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdatePreferencesRequest) =>
      api.patch<UserDto>(API_ROUTES.users.preferences, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.me });
      const previous = queryClient.getQueryData<UserDto>(profileKeys.me);

      queryClient.setQueryData<UserDto>(profileKeys.me, (current) =>
        current
          ? { ...current, preferences: mergePreferences(current.preferences, patch) }
          : current,
      );

      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(profileKeys.me, context.previous);
      toast.error(error instanceof Error ? error.message : 'Preferences could not be saved');
    },
    onSuccess: (user) => {
      queryClient.setQueryData(profileKeys.me, user);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: { displayName?: string; avatarUrl?: string | null }) =>
      api.patch<UserDto>(API_ROUTES.users.profile, patch),
    onSuccess: (user) => {
      queryClient.setQueryData(profileKeys.me, user);
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Profile could not be saved');
    },
  });
}
/**
 * Applies a patch to the cached preferences.
 *
 * A shallow spread would replace a whole group — patching `{ autoListen }` would
 * discard the stored rate, pitch, and volume — so each group is merged on its
 * own. The patch is a deep partial by design, which is what lets a single
 * toggle avoid sending the entire preference set on every keystroke.
 */
function mergePreferences(
  current: UserDto['preferences'],
  patch: UpdatePreferencesRequest,
): UserDto['preferences'] {
  return {
    ...current,
    ...patch,
    voice: { ...current.voice, ...patch.voice },
    ai: { ...current.ai, ...patch.ai },
    notifications: { ...current.notifications, ...patch.notifications },
    accessibility: { ...current.accessibility, ...patch.accessibility },
  };
}
