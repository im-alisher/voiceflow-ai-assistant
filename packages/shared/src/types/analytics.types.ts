import type { ConversationStatus } from '../enums/conversation-status.enum';

/**
 * Aggregate usage figures for the signed-in user.
 *
 * Every number is derived from the user's own rows at request time rather than
 * maintained in a counter column: a counter that drifts on a failed write is
 * worse than a query that is a little slower.
 */
export interface AnalyticsSummaryDto {
  readonly totals: AnalyticsTotalsDto;
  readonly latency: LatencyStatsDto;
  readonly providers: readonly ProviderUsageDto[];
  readonly generatedAt: string;
}

export interface AnalyticsTotalsDto {
  readonly conversations: number;
  readonly activeConversations: number;
  readonly archivedConversations: number;
  readonly messages: number;
  readonly voiceMessages: number;
  readonly tokens: number;
}

export interface LatencyStatsDto {
  /** Mean assistant latency. Null when no turn has completed yet. */
  readonly averageMs: number | null;
  /** 95th percentile, computed with linear interpolation over a small sample. */
  readonly p95Ms: number | null;
  readonly sampleSize: number;
}

export interface ProviderUsageDto {
  readonly providerId: string;
  readonly model: string | null;
  readonly messages: number;
  readonly tokens: number;
  /** 0–1 fraction of the user's token spend; the UI renders this as a bar. */
  readonly share: number;
}

/** One bucket in the usage time series. */
export interface UsagePointDto {
  /** `YYYY-MM-DD` in UTC. */
  readonly date: string;
  readonly messages: number;
  readonly tokens: number;
  readonly voiceMessages: number;
}

export interface AnalyticsUsageDto {
  readonly days: number;
  readonly from: string;
  readonly to: string;
  /** Dense: every day in the range is present, zeros included. */
  readonly points: readonly UsagePointDto[];
}

/** Recent threads, used for the dashboard activity feed. */
export interface ActivityConversationDto {
  readonly id: string;
  readonly title: string;
  readonly status: ConversationStatus;
  readonly isPinned: boolean;
  readonly messageCount: number;
  readonly tokens: number;
  readonly lastMessageAt: string | null;
}
