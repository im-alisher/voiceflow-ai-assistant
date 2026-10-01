import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ANALYTICS_DEFAULT_DAYS, ANALYTICS_MAX_DAYS, type UsagePointDto } from '@voiceflow/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAnalyticsUsage } from '@/features/analytics/use-analytics';

const RANGES = [7, 14, 30, 90] as const;

/**
 * Daily usage bars.
 *
 * Hand-drawn with divs rather than pulled from a charting library: one metric,
 * one series, and no dependency is a better trade than a general-purpose chart
 * engine. The bars are `role="img"` with a text summary, because a chart a
 * screen reader cannot read is not a chart.
 */
export function UsageChart() {
  const [days, setDays] = useState<number>(ANALYTICS_DEFAULT_DAYS);
  const { data, isLoading, isError } = useAnalyticsUsage(days);

  // Memoed so the peak does not recompute against a fresh array identity on
  // every render while a refetch is in flight.
  const points = useMemo(() => data?.points ?? [], [data]);
  const peak = useMemo(() => Math.max(1, ...points.map((point) => point.tokens)), [points]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Daily token usage
          </CardTitle>
          <CardDescription>Tokens recorded on stored messages, grouped by day.</CardDescription>
        </div>
        <div className="flex gap-1">
          {RANGES.map((range) => (
            <Button
              key={range}
              size="sm"
              variant={days === range ? 'default' : 'ghost'}
              onClick={() => setDays(Math.min(range, ANALYTICS_MAX_DAYS))}
            >
              {range}d
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
            Loading usage…
          </div>
        ) : isError ? (
          <p className="text-destructive py-10 text-center text-sm">Usage could not be loaded.</p>
        ) : (
          <>
            <UsageBars points={points} peak={peak} />
            <UsageLegend points={points} days={days} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UsageBars({ points, peak }: { points: readonly UsagePointDto[]; peak: number }) {
  const total = points.reduce((sum, point) => sum + point.tokens, 0);
  const summary = `${points.length} days, ${total} tokens total, peak ${peak} tokens in a day.`;

  if (points.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">No usage recorded yet.</p>
    );
  }

  return (
    <div role="img" aria-label={summary} className="flex h-40 items-end gap-[2px]">
      {points.map((point) => {
        const ratio = point.tokens / peak;
        return (
          <div
            key={point.date}
            title={`${point.date}: ${point.tokens} tokens, ${point.messages} messages`}
            className={cn(
              'bg-primary/70 hover:bg-primary min-w-[2px] flex-1 rounded-sm transition-colors',
              ratio === 0 && 'bg-muted',
            )}
            style={{ height: `${Math.max(point.tokens > 0 ? 4 : 1, ratio * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

function UsageLegend({ points, days }: { points: readonly UsagePointDto[]; days: number }) {
  const totals = points.reduce(
    (accumulator, point) => ({
      messages: accumulator.messages + point.messages,
      tokens: accumulator.tokens + point.tokens,
      voice: accumulator.voice + point.voiceMessages,
    }),
    { messages: 0, tokens: 0, voice: 0 },
  );

  return (
    <dl className="text-muted-foreground mt-4 grid grid-cols-3 gap-4 text-xs">
      <div>
        <dt>Window</dt>
        <dd className="text-foreground font-medium tabular-nums">{days} days</dd>
      </div>
      <div>
        <dt>Messages</dt>
        <dd className="text-foreground font-medium tabular-nums">
          {totals.messages.toLocaleString()}
        </dd>
      </div>
      <div>
        <dt>Voice turns</dt>
        <dd className="text-foreground font-medium tabular-nums">
          {totals.voice.toLocaleString()}
        </dd>
      </div>
    </dl>
  );
}
