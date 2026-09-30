import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-media-query';

/**
 * Application chrome: sidebar plus scrolling main region.
 *
 * The viewport is split as `h-screen` with a `min-h-0` main column, so the
 * message list and the sidebar scroll independently instead of the whole
 * document scrolling behind a fixed header.
 *
 * On narrow viewports the sidebar is swapped for a drawer. The desktop aside is
 * unmounted rather than merely hidden so its links are not reachable by
 * keyboard or screen reader while it is off-screen.
 */
export function AppShell() {
  const isMobile = useIsMobile();

  return (
    <div className="bg-background text-foreground flex h-screen w-full overflow-hidden">
      {isMobile ? <MobileNav /> : <AppSidebar className="w-64 shrink-0 xl:w-72" />}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />

        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <Suspense fallback={<RouteSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Shared loading state for lazily loaded routes.
 *
 * Mirrors the real page geometry (heading block plus card grid) so the layout
 * does not jump when the route module resolves.
 */
function RouteSkeleton() {
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
