import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditional class names.
 *
 * `clsx` handles the conditional composition, `tailwind-merge` resolves
 * conflicting Tailwind utilities so a caller-supplied class always wins over a
 * component default (e.g. `cn('p-2', 'p-4')` -> `'p-4'`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
