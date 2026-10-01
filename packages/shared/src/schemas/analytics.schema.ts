import { z } from 'zod';

/** Analytics window, clamped server-side so a typo cannot request 100k days. */
export const ANALYTICS_MAX_DAYS = 90;
export const ANALYTICS_DEFAULT_DAYS = 30;

export const analyticsUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(ANALYTICS_MAX_DAYS).default(ANALYTICS_DEFAULT_DAYS),
});

export const analyticsActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).default(5),
});

export type AnalyticsUsageQuery = z.infer<typeof analyticsUsageQuerySchema>;
export type AnalyticsActivityQuery = z.infer<typeof analyticsActivityQuerySchema>;
