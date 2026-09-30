import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/dashboard/stat-card';
import { ROUTES } from '@/routes/paths';

/**
 * Chat route placeholder.
 *
 * The conversation surface is built in Phase 5; this exists so the navigation,
 * layout, and routing can be exercised end to end first.
 */
export default function ChatPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Conversations"
        description="Threaded chat with the assistant, including streaming responses and intent routing."
        badge={<Badge variant="secondary">Phase 5</Badge>}
      />
      <EmptyState
        icon={<MessageSquare className="h-6 w-6" />}
        title="No conversations yet"
        description="The message composer, transcript, and streaming indicators land in Phase 5. This route exists so the surrounding layout is verifiable now."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.dashboard}>Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
