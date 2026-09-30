import { NavLink } from 'react-router-dom';
import { type NavigationItem } from '@/features/navigation/navigation.config';
import { cn } from '@/lib/utils';

interface NavLinkButtonProps {
  item: NavigationItem;
  onNavigate?: () => void;
  variant?: 'default' | 'primary' | 'quiet';
  className?: string;
}

/**
 * A single navigation row.
 *
 * `NavLink` supplies both the active state and an accessible
 * `aria-current="page"`, which is why the active styling is driven by
 * `isActive` rather than by comparing paths in this component.
 */
export function NavLinkButton({
  item,
  onNavigate,
  variant = 'default',
  className,
}: NavLinkButtonProps) {
  const Icon = item.icon;

  const base =
    'group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar';

  const variants = {
    default: cn(
      base,
      'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground',
    ),
    primary: cn(base, 'text-primary-foreground hover:bg-primary/90'),
    quiet: cn(
      base,
      'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'aria-[current=page]:text-sidebar-accent-foreground',
    ),
  } as const;

  if (variant === 'quiet') {
    return (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={cn(variants[variant], 'flex-col items-start gap-0.5', className)}
        title={item.description}
      >
        <span className="truncate text-[13px]">{item.label}</span>
        <span className="text-muted-foreground truncate text-[11px] font-normal">
          {item.description}
        </span>
      </NavLink>
    );
  }

  return (
    <NavLink to={item.to} onClick={onNavigate} className={cn(variants[variant], className)}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}
