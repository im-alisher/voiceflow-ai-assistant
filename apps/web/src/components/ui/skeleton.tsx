import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Loading placeholder.
 *
 * Rendered with `aria-hidden` and accompanied by a `role="status"` label at the
 * call site, so a screen reader hears "Loading" rather than nothing at all.
 */
const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn('bg-muted animate-pulse rounded-md', className)}
    {...props}
  />
));
Skeleton.displayName = 'Skeleton';

export { Skeleton };
