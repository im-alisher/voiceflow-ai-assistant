import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/routes/paths';

/** Catch-all route, rendered inside the app shell. */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <span className="bg-muted text-muted-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          That route does not exist. It may have been renamed, or the link that brought you here may
          be out of date.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild>
          <Link to={ROUTES.dashboard}>Back to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.chat}>Open conversations</Link>
        </Button>
      </div>
    </div>
  );
}
