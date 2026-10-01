import type { ActivityConversationDto, AnalyticsTotalsDto } from '@voiceflow/shared';

/** Raw aggregate straight from SQL, before any presentation arithmetic. */
export interface ProviderUsageRow {
  readonly providerId: string;
  readonly model: string | null;
  readonly messages: number;
  readonly tokens: number;
}

export interface UsageBucketRow {
  /** `YYYY-MM-DD` in UTC. */
  readonly date: string;
  readonly messages: number;
  readonly tokens: number;
  readonly voiceMessages: number;
}

/**
 * Read side of the analytics context.
 *
 * A port rather than a repository, for a specific reason: every read here is an
 * aggregate over two joined tables. Expressing that as a `Repository` method
 * would either leak SQL into the service or force the service to know about
 * query builders, and the arithmetic (shares, percentiles, dense series) is the
 * part actually worth testing.
 *
 * The implementation owns the SQL; the service owns the maths.
 */
export interface AnalyticsReader {
  totals(userId: string): Promise<AnalyticsTotalsDto>;
  /** Assistant latencies in ms, ascending. Null entries are dropped by the adapter. */
  latencies(userId: string): Promise<readonly number[]>;
  providerUsage(userId: string): Promise<readonly ProviderUsageRow[]>;
  usageBuckets(userId: string, from: Date, to: Date): Promise<readonly UsageBucketRow[]>;
  recentConversations(userId: string, limit: number): Promise<readonly ActivityConversationDto[]>;
}

export const ANALYTICS_READER = Symbol('ANALYTICS_READER');
