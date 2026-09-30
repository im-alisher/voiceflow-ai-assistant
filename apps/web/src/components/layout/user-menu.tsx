import { LogOut, Settings, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/features/auth/auth-store';
import { useLogout } from '@/features/auth/use-auth';
import { ROUTES } from '@/routes/paths';

/** Up to two initials, derived from whatever part of the name is present. */
function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Account menu: profile, settings, and sign-out. */
export function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const { logout, isPending } = useLogout();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="focus-visible:ring-ring focus-visible:ring-offset-background rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="Account menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initialsFor(user.displayName)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="text-foreground block truncate text-sm font-medium">
            {user.displayName}
          </span>
          <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to={ROUTES.settingsAccount}>
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to={ROUTES.settings}>
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            // `onSelect` fires on click; preventing the default stops the menu
            // from closing before the navigation completes.
            event.preventDefault();
            logout();
            navigate(ROUTES.login, { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {isPending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
