import type { ActivityConversationDto, AnalyticsTotalsDto } from '@voiceflow/shared';
import type { Clock } from '../../common';
import { AnalyticsService, clampDays, densify, percentile, withShares } from './analytics.service';
import type { AnalyticsReader, ProviderUsageRow, UsageBucketRow } from './analytics.reader';

const FIXED_NOW = new Date('2026-03-15T12:30:00.000Z');

class FakeReader implements AnalyticsReader {
  totalsRow: AnalyticsTotalsDto = {
    conversations: 0,
    activeConversations: 0,
    archivedConversations: 0,
    messages: 0,
    voiceMessages: 0,
    tokens: 0,
  };

  latencyValues: number[] = [];
  providerRows: { providerId: string; model: string | null; messages: number; tokens: number }[] =
    [];
  bucketRows: UsageBucketRow[] = [];

  readonly calls: string[] = [];

  totals(): Promise<AnalyticsTotalsDto> {
    this.calls.push('totals');
    return Promise.resolve(this.totalsRow);
  }

  latencies(): Promise<readonly number[]> {
    this.calls.push('latencies');
    return Promise.resolve(this.latencyValues);
  }

  providerUsage(): Promise<ProviderUsageRow[]> {
    this.calls.push('providerUsage');
    return Promise.resolve(this.providerRows);
  }

  usageBuckets(): Promise<UsageBucketRow[]> {
    this.calls.push('usageBuckets');
    return Promise.resolve(this.bucketRows);
  }

  recentConversations(_userId: string, limit: number): Promise<ActivityConversationDto[]> {
    this.calls.push(`recent:${limit}`);
    return Promise.resolve(
      Array.from({ length: limit }, (_unused, index) => ({
        id: `c${index}`,
        title: `Thread ${index}`,
        status: 'active' as const,
        isPinned: false,
        messageCount: 2,
        tokens: 30,
        lastMessageAt: null,
      })),
    );
  }
}

describe('AnalyticsService', () => {
  let reader: FakeReader;
  let service: AnalyticsService;
  const clock: Clock = { now: () => FIXED_NOW, nowMs: () => FIXED_NOW.getTime() };

  beforeEach(() => {
    reader = new FakeReader();
    service = new AnalyticsService(reader, clock);
  });

  describe('summary', () => {
    it('reports null latency for a user with no completed turns', async () => {
      const summary = await service.summary('user-1');

      expect(summary.latency).toEqual({ averageMs: null, p95Ms: null, sampleSize: 0 });
      expect(summary.generatedAt).toBe(FIXED_NOW.toISOString());
    });

    it('computes mean and interpolated p95', async () => {
      reader.latencyValues = [100, 200, 300, 400];

      const { latency } = await service.summary('user-1');

      expect(latency.sampleSize).toBe(4);
      expect(latency.averageMs).toBe(250);
      // p95 of [100,200,300,400] sits at rank 2.85 -> 385
      expect(latency.p95Ms).toBe(385);
    });

    it('normalises provider shares to 1 and keeps zero-token providers visible', async () => {
      reader.providerRows = [
        { providerId: 'mock', model: 'mock-assistant-v1', messages: 10, tokens: 300 },
        { providerId: 'local', model: null, messages: 2, tokens: 100 },
        { providerId: 'free', model: null, messages: 1, tokens: 0 },
      ];

      const { providers } = await service.summary('user-1');

      expect(providers.map((provider) => provider.share)).toEqual([0.75, 0.25, 0]);
      expect(providers).toHaveLength(3);
    });

    it('does not divide by zero when nothing has been tokenised', async () => {
      reader.providerRows = [{ providerId: 'mock', model: null, messages: 4, tokens: 0 }];

      const { providers } = await service.summary('user-1');

      expect(providers[0]?.share).toBe(0);
    });
  });

  describe('usage', () => {
    it('zero-fills every day in the window', async () => {
      const usage = await service.usage('user-1', 3);

      expect(usage.points).toEqual([
        { date: '2026-03-13', messages: 0, tokens: 0, voiceMessages: 0 },
        { date: '2026-03-14', messages: 0, tokens: 0, voiceMessages: 0 },
        { date: '2026-03-15', messages: 0, tokens: 0, voiceMessages: 0 },
      ]);
      expect(usage.from).toBe('2026-03-13T00:00:00.000Z');
    });

    it('merges stored buckets into the dense series', async () => {
      reader.bucketRows = [
        { date: '2026-03-13', messages: 2, tokens: 40, voiceMessages: 1 },
        { date: '2026-03-15', messages: 5, tokens: 90, voiceMessages: 0 },
      ];

      const usage = await service.usage('user-1', 3);

      expect(usage.points.map((point) => point.messages)).toEqual([2, 0, 5]);
      expect(usage.points[2]).toMatchObject({ tokens: 90, voiceMessages: 0 });
    });

    it('clamps an out-of-range window instead of trusting it', () => {
      expect(clampDays(0)).toBe(1);
      expect(clampDays(9_999)).toBe(90);
      expect(clampDays(Number.NaN)).toBe(30);
      expect(clampDays(undefined)).toBe(30);
    });

    it('handles a window spanning a month boundary', () => {
      const points = densify(
        [{ date: '2026-03-01', messages: 4, tokens: 10, voiceMessages: 0 }],
        new Date('2026-02-27T00:00:00.000Z'),
        4,
      );

      expect(points.map((point) => point.date)).toEqual([
        '2026-02-27',
        '2026-02-28',
        '2026-03-01',
        '2026-03-02',
      ]);
      expect(points[2]?.messages).toBe(4);
    });
  });

  describe('activity', () => {
    it('bounds the requested page size', async () => {
      await service.activity('user-1', 100);

      expect(reader.calls).toContain('recent:25');
    });
  });
});

describe('percentile', () => {
  it('returns the only sample for a single-element series', () => {
    expect(percentile([42], 95)).toBe(42);
  });

  it('returns zero for an empty series rather than NaN', () => {
    expect(percentile([], 95)).toBe(0);
  });

  it('handles an exact rank', () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
  });
});

describe('withShares', () => {
  it('is stable when rows are empty', () => {
    expect(withShares([])).toEqual([]);
  });
});
