import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { RouteSkeleton } from '@/components/layout/route-skeleton';
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
