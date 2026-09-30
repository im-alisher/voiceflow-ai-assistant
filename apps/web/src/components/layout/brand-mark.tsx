import { Link } from 'react-router-dom';
import { BRAND } from '@/features/navigation/navigation.config';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  to: string;
  onNavigate?: () => void;
  className?: string;
}

/** Product mark: logotype plus the spark glyph, linking to the dashboard. */
export function BrandMark({ to, onNavigate, className }: BrandMarkProps) {
  const Icon = BRAND.mark;

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'focus-visible:ring-ring focus-visible:ring-offset-sidebar flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className,
      )}
      aria-label={`${BRAND.name} home`}
    >
      <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight">{BRAND.name}</span>
        <span className="text-muted-foreground mt-0.5 text-[11px]">{BRAND.tagline}</span>
      </span>
    </Link>
  );
}
