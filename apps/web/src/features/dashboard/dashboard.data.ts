import type { LucideIcon } from 'lucide-react';
import {
  Keyboard,
  MessagesSquare,
  Mic,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ROUTES } from '@/routes/paths';

export interface DashboardFeature {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly href: string;
  /** Not yet built; the card renders as inert rather than as a dead link. */
  readonly disabled: boolean;
}

/**
 * Quick-start grid.
 *
 * `disabled` entries stay visible on purpose: showing the intended shape of the
 * product is more useful during layout work than hiding unfinished sections.
 */
export const FEATURES: readonly DashboardFeature[] = [
  {
    id: 'conversations',
    title: 'Conversations',
    description: 'Start a threaded chat and review the assistant transcript.',
    icon: MessagesSquare,
    href: ROUTES.chat,
    disabled: false,
  },
  {
    id: 'voice',
    title: 'Voice lab',
    description: 'Test speech recognition and synthesis with live levels.',
    icon: Mic,
    href: ROUTES.voiceLab,
    disabled: true,
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Theme, density, and text scaling preferences.',
    icon: Palette,
    href: ROUTES.settingsAppearance,
    disabled: true,
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'AI provider, voice, and notification configuration.',
    icon: Settings,
    href: ROUTES.settings,
    disabled: true,
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    description: 'Jump between sections and send messages without a mouse.',
    icon: Keyboard,
    href: ROUTES.settings,
    disabled: true,
  },
  {
    id: 'privacy',
    title: 'Privacy controls',
    description: 'Review stored sessions and revoke access.',
    icon: ShieldCheck,
    href: ROUTES.settingsAccount,
    disabled: true,
  },
] as const;

export const DASHBOARD_HIGHLIGHT_ICON = Sparkles;
