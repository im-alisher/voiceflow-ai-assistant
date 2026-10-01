import { useQuery } from '@tanstack/react-query';
import {
  API_ROUTES,
  ANALYTICS_DEFAULT_DAYS,
  type ActivityConversationDto,
  type AnalyticsSummaryDto,
  type AnalyticsUsageDto,
} from '@voiceflow/shared';
import { api } from '@/lib/api-client';

export const analyticsKeys = {
  all: ['analytics'] as const,
  summary: ['analytics', 'summary'] as const,
  usage: (days: number) => ['analytics', 'usage', days] as const,
  activity: (limit: number) => ['analytics', 'activity', limit] as const,
};

/**
 * Totals, latency and provider mix.
 *
 * Refetched on window focus but not on an interval: these figures change only
 * when the user sends a message, so polling would spend requests to redraw the
 * same numbers.
 */
export function useAnalyticsSummary() {
  return useQuery({
    queryKey: analyticsKeys.summary,
    queryFn: () => api.get<AnalyticsSummaryDto>(API_ROUTES.analytics.summary),
    staleTime: 30_000,
  });
}

export function useAnalyticsUsage(days: number = ANALYTICS_DEFAULT_DAYS) {
  return useQuery({
    queryKey: analyticsKeys.usage(days),
    queryFn: () =>
      api.get<AnalyticsUsageDto>(
        `${API_ROUTES.analytics.usage}?days=${encodeURIComponent(String(days))}`,
      ),
    staleTime: 60_000,
  });
}

export function useRecentActivity(limit = 5) {
  return useQuery({
    queryKey: analyticsKeys.activity(limit),
    queryFn: () =>
      api.get<readonly ActivityConversationDto[]>(
        `${API_ROUTES.analytics.activity}?limit=${encodeURIComponent(String(limit))}`,
      ),
    staleTime: 30_000,
  });
}
