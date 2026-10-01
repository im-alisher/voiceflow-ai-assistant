import { useEffect } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { type LucideIcon } from 'lucide-react';
import { Accessibility, Bell, Brain, Mic, Monitor, UserCog } from 'lucide-react';
import { isSettingsSection, type SettingsSection } from '@voiceflow/shared';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import {
  AccessibilitySection,
  AppearanceSection,
  GeneralSection,
  NotificationsSection,
} from '@/components/settings/sections';
import { AiSection, VoiceSection } from '@/components/settings/voice-ai-sections';
import { AccountSection } from '@/components/settings/account-section';
import { useProfile } from '@/features/settings/use-profile';
import { ROUTES } from '@/routes/paths';
import { cn } from '@/lib/utils';

const SECTIONS: readonly { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: UserCog },
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'ai', label: 'AI provider', icon: Brain },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { id: 'account', label: 'Account', icon: UserCog },
];

/**
 * Settings.
 *
 * One page with a section in the URL rather than one route per section: a deep
 * link like `/settings/account` survives a reload and can be shared, which a
 * tab that only lives in component state cannot do.
 */
export default function SettingsPage() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { data: profile } = useProfile();

  const active: SettingsSection = isSettingsSection(section) ? section : 'general';

  // `settings` without a section is a valid entry point; canonicalise it so the
  // selected tab always has a URL and the back button behaves predictably.
  useEffect(() => {
    if (!section) navigate(ROUTES.settingsGeneral, { replace: true });
  }, [section, navigate]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Preferences are saved to your account and applied immediately."
        badge={<Badge variant="secondary">{profile?.preferences.theme ?? 'system'} theme</Badge>}
      />

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <NavLink
                  to={ROUTES.settingsSection(id)}
                  aria-current={active === id ? 'page' : undefined}
                  className={cn(
                    'hover:bg-muted flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
                    active === id ? 'bg-muted font-medium' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <SectionPanel section={active} />
        </div>
      </div>
    </div>
  );
}

function SectionPanel({ section }: { section: SettingsSection }) {
  switch (section) {
    case 'appearance':
      return <AppearanceSection />;
    case 'voice':
      return <VoiceSection />;
    case 'ai':
      return <AiSection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'accessibility':
      return <AccessibilitySection />;
    case 'account':
      return <AccountSection />;
    case 'general':
    default:
      return <GeneralSection />;
  }
}
