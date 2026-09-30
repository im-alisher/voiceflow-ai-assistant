import { Outlet } from 'react-router-dom';
import { BrandMark } from '@/components/layout/brand-mark';
import { ROUTES } from '@/routes/paths';

/**
 * Chrome for the unauthenticated screens.
 *
 * Deliberately omits the sidebar and header: a signed-out user has no workspace
 * to navigate, and showing navigation links would only produce dead ends.
 */
export function AuthLayout() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="px-6 py-6">
        <BrandMark to={ROUTES.dashboard} />
      </header>

      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      <footer className="text-muted-foreground px-6 py-6 text-center text-xs">
        Voiceflow runs entirely on your own infrastructure.
      </footer>
    </div>
  );
}
