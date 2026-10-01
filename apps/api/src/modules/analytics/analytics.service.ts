import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../common';
import {
  ANALYTICS_DEFAULT_DAYS,
  ANALYTICS_MAX_DAYS,
  type ActivityConversationDto,
  type AnalyticsSummaryDto,
  type AnalyticsUsageDto,
  type LatencyStatsDto,
  type ProviderUsageDto,
  type UsagePointDto,
} from '@voiceflow/shared';
import { ANALYTICS_READER, type AnalyticsReader, type UsageBucketRow } from './analytics.reader';

/**
 * Usage reporting.
 *
 * Every figure is computed per request from the user's own rows. Nothing is
 * cached or accumulated, which keeps a number on the dashboard impossible to
 * desynchronise from the transcript it describes — at the cost of a few indexed
 * aggregates, which are cheap next to the cost of being quietly wrong.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_READER) private readonly reader: AnalyticsReader,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async summary(userId: string): Promise<AnalyticsSummaryDto> {
    const [totals, latencies, providerRows] = await Promise.all([
      this.reader.totals(userId),
      this.reader.latencies(userId),
      this.reader.providerUsage(userId),
    ]);

    return {
      totals,
      latency: summariseLatency(latencies),
      providers: withShares(providerRows),
      generatedAt: this.clock.now().toISOString(),
    };
  }

  /**
   * Dense daily series over a trailing window.
   *
   * Days with no activity are emitted as zeroes rather than omitted: a chart
   * that silently skips quiet days exaggerates the gaps between active ones,
   * and a client cannot tell a missing day from a query bug.
   */
  async usage(userId: string, requestedDays: number): Promise<AnalyticsUsageDto> {
    const days = clampDays(requestedDays);
    const now = this.clock.now();

    // Start-of-day for `days - 1` days ago, so the window ends with today.
    const from = startOfUtcDay(now);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const to = new Date(now);

    const buckets = await this.reader.usageBuckets(userId, from, to);

    return {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      points: densify(buckets, from, days),
    };
  }

  async activity(userId: string, limit: number): Promise<readonly ActivityConversationDto[]> {
    return this.reader.recentConversations(userId, clampLimit(limit));
  }
}

export function summariseLatency(sortedAscending: readonly number[]): LatencyStatsDto {
  const samples = [...sortedAscending].sort((a, b) => a - b);
  if (samples.length === 0) {
    return { averageMs: null, p95Ms: null, sampleSize: 0 };
  }

  const sum = samples.reduce((total, value) => total + value, 0);

  return {
    averageMs: Math.round(sum / samples.length),
    p95Ms: Math.round(percentile(samples, 95)),
    sampleSize: samples.length,
  };
}

/**
 * Linear-interpolated percentile.
 *
 * Nearest-rank would be cheaper, but with the handful of samples a single user
 * accumulates it produces visibly steppy p95 values (100, 100, 400, 400…).
 */
export function percentile(sortedAscending: readonly number[], p: number): number {
  if (sortedAscending.length === 0) return 0;
  if (sortedAscending.length === 1) return sortedAscending[0] as number;

  const rank = (p / 100) * (sortedAscending.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);

  if (lower === upper) return sortedAscending[lower] as number;

  const weight = rank - lower;
  const low = sortedAscending[lower] as number;
  const high = sortedAscending[upper] as number;

  return low + (high - low) * weight;
}

/**
 * Converts raw provider rows into shares of total spend.
 *
 * A provider with messages but zero tokens gets a zero share rather than being
 * dropped: it was used, and hiding it would understate how much of the
 * transcript ran on it.
 */
export function withShares(
  rows: readonly { providerId: string; model: string | null; messages: number; tokens: number }[],
): readonly ProviderUsageDto[] {
  const totalTokens = rows.reduce((total, row) => total + row.tokens, 0);

  return rows.map((row) => ({
    providerId: row.providerId,
    model: row.model,
    messages: row.messages,
    tokens: row.tokens,
    share: totalTokens === 0 ? 0 : round(row.tokens / totalTokens, 4),
  }));
}

export function densify(
  buckets: readonly UsageBucketRow[],
  from: Date,
  days: number,
): readonly UsagePointDto[] {
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  const points: UsagePointDto[] = [];

  const cursor = new Date(from);
  for (let index = 0; index < days; index += 1) {
    const date = cursor.toISOString().slice(0, 10);
    const bucket = byDate.get(date);

    points.push({
      date,
      messages: bucket?.messages ?? 0,
      tokens: bucket?.tokens ?? 0,
      voiceMessages: bucket?.voiceMessages ?? 0,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

function startOfUtcDay(value: Date): Date {
  const copy = new Date(value);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function clampDays(requested?: number): number {
  if (typeof requested !== 'number' || Number.isNaN(requested)) return ANALYTICS_DEFAULT_DAYS;
  return Math.min(Math.max(Math.trunc(requested), 1), ANALYTICS_MAX_DAYS);
}

function clampLimit(requested?: number): number {
  if (typeof requested !== 'number' || Number.isNaN(requested)) return 5;
  return Math.min(Math.max(Math.trunc(requested), 1), 25);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
