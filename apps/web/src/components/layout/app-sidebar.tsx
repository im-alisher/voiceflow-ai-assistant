import { BrandMark } from '@/components/layout/brand-mark';
import { NavLinkButton } from '@/components/layout/nav-link-button';
import {
  BRAND,
  NAV_SECTIONS,
  NEW_CONVERSATION_ACTION,
  type NavigationItem,
} from '@/features/navigation/navigation.config';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';

interface AppSidebarProps {
  /** Called after any navigation, so the mobile drawer can close itself. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * Primary navigation surface.
 *
 * Rendered twice — once inline in the desktop grid and once inside a `Sheet`
 * on narrow viewports. Keeping the markup in a single component is what
 * guarantees the two can never drift apart.
 */
export function AppSidebar({ onNavigate, className }: AppSidebarProps) {
  const isConversationListOpen = useUiStore((state) => state.isConversationListOpen);
  const toggleConversationList = useUiStore((state) => state.toggleConversationList);

  return (
    <aside
      className={cn(
        'border-sidebar-border bg-sidebar text-sidebar-foreground flex h-full min-h-0 w-full flex-col border-r',
        className,
      )}
      aria-label="Primary navigation"
    >
      <div className="border-sidebar-border flex h-16 shrink-0 items-center border-b px-4">
        <BrandMark to={ROUTES.dashboard} onNavigate={onNavigate} />
      </div>

      <div className="shrink-0 px-3 py-3">
        <NavLinkButton
          item={NEW_CONVERSATION_ACTION}
          onNavigate={onNavigate}
          variant="primary"
          className="w-full justify-start"
        />
      </div>

      <nav
        className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-3 pb-4"
        aria-label="Sections"
      >
        {NAV_SECTIONS.map((section, index) => (
          <div key={section.id} className={cn(index > 0 && 'mt-6')}>
            <p className="text-muted-foreground px-2 pb-2 text-xs font-semibold uppercase tracking-wider">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <NavLinkButton item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border shrink-0 border-t">
        <button
          type="button"
          onClick={toggleConversationList}
          aria-expanded={isConversationListOpen}
          className="text-muted-foreground hover:text-sidebar-foreground flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors"
        >
          <span>Recent</span>
          <span aria-hidden="true" className="text-base leading-none">
            {isConversationListOpen ? '−' : '+'}
          </span>
        </button>
        <RecentConversations isCollapsed={!isConversationListOpen} onNavigate={onNavigate} />
      </div>
    </aside>
  );
}

function RecentConversations({
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  if (isCollapsed) return <div className="h-2" />;

  return (
    <div className="scrollbar-slim max-h-64 overflow-y-auto px-2 pb-3">
      <ul className="space-y-0.5">
        {PLACEHOLDER_RECENT.map((conversation) => (
          <li key={conversation.id}>
            <NavLinkButton
              item={conversation}
              onNavigate={onNavigate}
              variant="quiet"
              className="h-auto justify-start gap-2 py-2"
            />
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground px-2 pt-3 text-xs leading-relaxed">
        History is replaced by live data once conversations are created.
      </p>
    </div>
  );
}

/**
 * Static rows shown until the conversation query is wired in.
 *
 * Presentational only — no data fetching — so the sidebar renders identically
 * in every state and the layout can be reviewed before the API contract lands.
 */
const PLACEHOLDER_RECENT: readonly NavigationItem[] = [
  {
    id: 'recent-1',
    label: 'Morning stand-up notes',
    to: ROUTES.conversation('00000000-0000-4000-8000-000000000001'),
    icon: BRAND.mark,
    description: 'Last active 4 minutes ago',
  },
  {
    id: 'recent-2',
    label: 'Voice latency research',
    to: ROUTES.conversation('00000000-0000-4000-8000-000000000002'),
    icon: BRAND.mark,
    description: 'Last active yesterday',
  },
];
