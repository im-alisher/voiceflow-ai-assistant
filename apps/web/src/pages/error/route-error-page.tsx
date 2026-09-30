import { AlertTriangle, Compass } from 'lucide-react';
import { Link, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/routes/paths';

/**
 * Catches render-time failures anywhere below the router.
 *
 * The technical detail is deliberately logged to the console and kept out of
 * the rendered output: an error message on screen is not actionable for a
 * user, and it can leak internals if a build is served publicly.
 */
export function RouteErrorPage() {
  const error = useRouteError();

  const isNotFound = !error;
  const detail = error instanceof Error ? error.message : String(error ?? '');

  if (!isNotFound) {
    console.error('Unhandled route error:', error);
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <span className="bg-muted text-muted-foreground mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
          {isNotFound ? (
            <Compass className="h-7 w-7" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          )}
        </span>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNotFound ? 'Page not found' : 'Something went wrong'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isNotFound
              ? 'The page you requested does not exist or has been moved.'
              : 'An unexpected error interrupted this page. The details were written to the browser console.'}
          </p>
        </div>

        {!isNotFound && detail ? (
          <pre className="scrollbar-slim bg-muted text-muted-foreground max-h-40 overflow-auto rounded-md p-3 text-left text-xs">
            {detail}
          </pre>
        ) : null}

        <Button asChild>
          <Link to={ROUTES.dashboard}>Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
