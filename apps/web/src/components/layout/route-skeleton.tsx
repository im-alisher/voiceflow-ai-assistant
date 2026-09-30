import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shared loading state for lazily loaded routes.
 *
 * Mirrors the real page geometry (heading block plus card grid) so the layout
 * does not jump when the route module resolves.
 */
export function RouteSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading page</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
