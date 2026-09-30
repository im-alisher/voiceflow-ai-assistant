import {
  BarChart3,
  type LucideIcon,
  MessageSquare,
  Mic,
  Plus,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { ROUTES } from '@/routes/paths';

export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  readonly icon: LucideIcon;
  readonly description: string;
  /** `exact` prevents `/chat` from also highlighting `/chat/:id`. */
  readonly exact?: boolean;
}

/**
 * Primary navigation.
 *
 * Grouped so the sidebar can render sections with a heading and a divider,
 * which is far easier to scan than a single flat list as the app grows.
 */
export const NAV_SECTIONS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavigationItem[];
}> = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        to: ROUTES.dashboard,
        icon: BarChart3,
        description: 'Overview of your workspace',
        exact: true,
      },
      {
        id: 'chat',
        label: 'Conversations',
        to: ROUTES.chat,
        icon: MessageSquare,
        description: 'Talk to the assistant',
      },
      {
        id: 'voice',
        label: 'Voice lab',
        to: ROUTES.voiceLab,
        icon: Mic,
        description: 'Speech-to-text and text-to-speech',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        to: ROUTES.settings,
        icon: Settings,
        description: 'Preferences and appearance',
      },
      {
        id: 'profile',
        label: 'Profile',
        to: ROUTES.settingsAccount,
        icon: UserRound,
        description: 'Your account details',
      },
    ],
  },
];

export const NAV_ITEMS: readonly NavigationItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);

/** Primary call to action rendered above the navigation list. */
export const NEW_CONVERSATION_ACTION: NavigationItem = {
  id: 'new-conversation',
  label: 'New conversation',
  to: ROUTES.chat,
  icon: Plus,
  description: 'Start a fresh thread',
};

export const BRAND = {
  name: 'Voiceflow',
  mark: Sparkles,
  tagline: 'Voice-first AI assistant',
} as const;
