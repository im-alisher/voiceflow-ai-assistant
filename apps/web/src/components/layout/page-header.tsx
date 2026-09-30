import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard page heading block.
 *
 * Rendered as a labelled `header` so the page title is exposed as the
 * landmark screen-reader users navigate to, not just as a styled heading.
 */
export function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
