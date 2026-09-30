import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

/**
 * Single metric tile.
 *
 * `value` is passed as a string rather than a node so callers format numbers
 * once, and the label/value pair uses a `dl` so the relationship between them
 * is not conveyed by layout alone.
 */
export function StatCard({ label, value, hint, icon, badge, className }: StatCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent>
        <dl className="space-y-1">
          <dd className="text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
          {hint ? <dt className="sr-only">{label} detail</dt> : null}
        </dl>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
        {badge ? <div className="mt-3">{badge}</div> : null}
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/** Empty/zero-state block used by panels with no data yet. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <CardDescription className="mx-auto max-w-sm text-balance">{description}</CardDescription>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  disabled?: boolean;
}

/** Navigation card used on the dashboard quick-start grid. */
export function FeatureCard({ title, description, icon, href, disabled }: FeatureCardProps) {
  const body = (
    <>
      <span className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
        {icon}
      </span>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </>
  );

  const className = cn(
    'flex h-full flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors',
    disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-primary/40 hover:bg-accent/50',
  );

  if (disabled) {
    return (
      <div className={className} aria-disabled="true">
        {body}
        <Badge variant="outline" className="mt-4 self-start">
          Coming soon
        </Badge>
      </div>
    );
  }

  return (
    <Link
      to={href}
      className={cn(
        className,
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      )}
    >
      {body}
    </Link>
  );
}
