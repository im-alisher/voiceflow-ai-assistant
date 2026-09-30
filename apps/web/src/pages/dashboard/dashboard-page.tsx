import { Activity, Cpu, Gauge, MessageSquare, Mic, Settings, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, FeatureCard, StatCard } from '@/components/dashboard/stat-card';
import { FEATURES } from '@/features/dashboard/dashboard.data';
import { ROUTES } from '@/routes/paths';

/**
 * Landing page for the workspace.
 *
 * Metrics are intentionally static placeholders: the analytics endpoints do not
 * exist yet, and rendering fake-but-plausible numbers next to real API-backed
 * cards would make it unclear which data can be trusted.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="An overview of your assistant workspace, provider status, and recent activity."
        badge={<Badge variant="secondary">Layout preview</Badge>}
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
            value="—"
            hint="Available after Phase 5"
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <StatCard
            label="Voice sessions"
            value="—"
            hint="Available after Phase 6"
            icon={<Mic className="h-4 w-4" />}
          />
          <StatCard
            label="Tokens used"
            value="—"
            hint="Available after Phase 7"
            icon={<Gauge className="h-4 w-4" />}
          />
          <StatCard
            label="Active provider"
            value="Mock"
            hint="Ships with no paid API keys"
            icon={<Cpu className="h-4 w-4" />}
            badge={<Badge variant="outline">Deterministic</Badge>}
          />
        </div>
      </section>

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
        <div>
          <h2 id="dashboard-activity" className="text-lg font-semibold tracking-tight">
            Recent activity
          </h2>
        </div>
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="Nothing here yet"
          description="Conversation and voice activity will appear here once the API is connected. No live data is shown in this preview."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to={ROUTES.settings}>
                <Settings className="h-4 w-4" />
                Configure settings
              </Link>
            </Button>
          }
        />
      </section>

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
