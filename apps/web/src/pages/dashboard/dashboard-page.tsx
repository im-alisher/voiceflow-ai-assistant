import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Cpu,
  Gauge,
  MessageSquare,
  Mic,
  MessagesSquare,
  Pin,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { AnalyticsSummaryDto, ActivityConversationDto } from '@voiceflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, FeatureCard, StatCard } from '@/components/dashboard/stat-card';
import { UsageChart } from '@/components/analytics/usage-chart';
import { FEATURES } from '@/features/dashboard/dashboard.data';
import { useAnalyticsSummary, useRecentActivity } from '@/features/analytics/use-analytics';
import { ROUTES } from '@/routes/paths';
import { formatRelativeTime } from '@/features/chat/chat-format';

const EMPTY_TOTALS = {
  conversations: 0,
  activeConversations: 0,
  archivedConversations: 0,
  messages: 0,
  voiceMessages: 0,
  tokens: 0,
};

/**
 * Workspace overview.
 *
 * Every figure here is read from the API at request time. The previous version
 * rendered em-dashes as placeholders, which is honest but makes the dashboard
 * indistinguishable from a broken one; now a real zero is shown instead, so "no
 * activity yet" is visibly different from "not implemented".
 */
export default function DashboardPage() {
  const summary = useAnalyticsSummary();
  const activity = useRecentActivity(5);

  const totals = summary.data?.totals ?? EMPTY_TOTALS;
  const providers = summary.data?.providers ?? [];
  const activeProvider = providers[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="An overview of your assistant workspace, provider status, and recent activity."
        badge={<Badge variant="secondary">Live</Badge>}
        actions={
          <Button asChild>
            <Link to={ROUTES.chat}>Start a conversation</Link>
          </Button>
        }
      />

      <section aria-labelledby="dashboard-metrics">
        <h2 id="dashboard-metrics" className="sr-only">
          Metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Conversations"
            value={summary.isLoading ? '—' : totals.conversations.toLocaleString()}
            hint={`${totals.activeConversations} active · ${totals.archivedConversations} archived`}
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <StatCard
            label="Voice sessions"
            value={summary.isLoading ? '—' : totals.voiceMessages.toLocaleString()}
            hint="Turns captured by speech"
            icon={<Mic className="h-4 w-4" />}
          />
          <StatCard
            label="Tokens used"
            value={summary.isLoading ? '—' : totals.tokens.toLocaleString()}
            hint={latencyHint(summary.data)}
            icon={<Gauge className="h-4 w-4" />}
          />
          <StatCard
            label="Active provider"
            value={summary.isLoading ? '—' : (activeProvider?.providerId ?? '—')}
            hint={
              providers.length > 1
                ? `${providers.length} providers in use`
                : 'Ships with no paid API keys'
            }
            icon={<Cpu className="h-4 w-4" />}
            badge={<Badge variant="outline">Deterministic</Badge>}
          />
        </div>
      </section>

      <UsageChart />

      <section aria-labelledby="dashboard-actions" className="space-y-4">
        <div>
          <h2 id="dashboard-actions" className="text-lg font-semibold tracking-tight">
            Get started
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Each area of the workspace opens in its own section of the app.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.id}
              title={feature.title}
              description={feature.description}
              icon={<feature.icon className="h-5 w-5" />}
              href={feature.href}
              disabled={feature.disabled}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="dashboard-activity" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="dashboard-activity" className="text-lg font-semibold tracking-tight">
            Recent activity
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.chat}>
              <MessagesSquare className="h-4 w-4" aria-hidden="true" />
              All conversations
            </Link>
          </Button>
        </div>
        <ActivityFeed items={activity.data ?? []} isLoading={activity.isLoading} />
      </section>

      <ProviderMix summary={summary.data} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary h-4 w-4" aria-hidden="true" />
            Running on mock providers
          </CardTitle>
          <CardDescription>
            Voiceflow ships with a deterministic mock AI provider so the app is fully usable without
            any paid API credentials. Switch providers in Settings when you are ready to connect a
            real service.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <p>
            Mock responses support intent detection, streaming, abort handling, and token
            accounting, which means the interface can be built and tested end to end before any
            spend occurs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityFeed({
  items,
  isLoading,
}: {
  items: readonly ActivityConversationDto[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Loading activity…</p>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title="No activity yet"
        description="Send your first message and the conversation will appear here."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.chat}>Start a conversation</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={ROUTES.conversation(item.id)}
                className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {item.isPinned && (
                      <Pin className="text-muted-foreground h-3 w-3 shrink-0" aria-hidden="true" />
                    )}
                    {item.title}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {item.messageCount} messages · {item.tokens.toLocaleString()} tokens
                    {item.lastMessageAt ? ` · ${formatRelativeTime(item.lastMessageAt)}` : ''}
                  </p>
                </div>
                {item.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ProviderMix({ summary }: { summary?: AnalyticsSummaryDto }) {
  const providers = useMemo(() => summary?.providers ?? [], [summary]);

  // Hooks run unconditionally; the empty case is handled after them.
  if (providers.length === 0) return null;

  const rows = providers.map((provider) => ({
    label: provider.model ? `${provider.providerId} · ${provider.model}` : provider.providerId,
    share: provider.share,
    messages: provider.messages,
    tokens: provider.tokens,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider mix</CardTitle>
        <CardDescription>Share of recorded tokens by provider and model.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="truncate font-medium">{row.label}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {Math.round(row.share * 100)}%
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${Math.max(row.share * 100, row.share > 0 ? 2 : 0)}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {row.messages} messages · {row.tokens.toLocaleString()} tokens
            </p>
          </div>
        ))}
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.settingsAi}>
            <Settings className="h-4 w-4" aria-hidden="true" />
            Configure providers
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function latencyHint(summary?: AnalyticsSummaryDto): string {
  if (!summary || summary.latency.averageMs === null) return 'No completed turns yet';
  return `Avg reply ${summary.latency.averageMs} ms · p95 ${summary.latency.p95Ms ?? '—'} ms`;
}
