import { Settings as SettingsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/dashboard/stat-card';

/** Settings placeholder; the real forms are implemented in Phase 8. */
export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Provider credentials, voice preferences, and account settings."
        badge={<Badge variant="secondary">Phase 8</Badge>}
      />
      <EmptyState
        icon={<SettingsIcon className="h-6 w-6" />}
        title="Settings are not wired up yet"
        description="Appearance, voice, AI provider, and account sections are introduced in Phase 8. Theme switching already works from the header."
      />
    </div>
  );
}
