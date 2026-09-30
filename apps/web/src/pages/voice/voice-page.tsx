import { Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/dashboard/stat-card';

/** Voice lab placeholder; the real capture/synthesis UI arrives in Phase 6. */
export default function VoicePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Voice lab"
        description="Capture speech, inspect transcripts, and audition synthesis voices."
        badge={<Badge variant="secondary">Phase 6</Badge>}
      />
      <EmptyState
        icon={<Mic className="h-6 w-6" />}
        title="Voice input is not available yet"
        description="Recording, level metering, and playback controls are added in Phase 6. No microphone permission is requested by this build."
      />
    </div>
  );
}
