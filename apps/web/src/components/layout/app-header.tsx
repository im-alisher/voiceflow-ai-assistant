import { Bell, Menu, Mic, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/components/theme/theme-provider';
import { useUiStore } from '@/stores/ui-store';
import { ROUTES } from '@/routes/paths';

/**
 * Sticky application header.
 *
 * The trigger for the navigation drawer is rendered here on narrow viewports
 * only; on desktop the sidebar is permanently visible and the button is hidden
 * by CSS so it is also removed from the accessibility tree order.
 */
export function AppHeader() {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <header className="border-border bg-background/80 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground truncate text-sm">Voice-first assistant workspace</p>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <Link to={ROUTES.voiceLab} aria-label="Voice lab">
                <Mic className="h-5 w-5" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Voice lab</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDark ? 'Light theme' : 'Dark theme'}</TooltipContent>
        </Tooltip>

        <Badge variant="outline" className="ml-2 hidden lg:inline-flex">
          Phase 3
        </Badge>
      </div>
    </header>
  );
}
