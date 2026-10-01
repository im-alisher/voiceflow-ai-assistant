/**
 * Date and text helpers for the chat surface.
 *
 * Deliberately dependency-free: the app ships no date library, and the few
 * formats needed here are stable enough to inline.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Coarse relative time for list rows and bubble timestamps.
 *
 * Deliberately vague past a week: "last active 3 months ago" is more useful in a
 * sidebar than a precise date the reader has to interpret.
 */
export function formatRelativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '';

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';

  const elapsed = now - timestamp;
  // A clock skew between client and server should not render as "in 4 minutes".
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(timestamp).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  });
}

/** Exact time for a message bubble's tooltip. */
export function formatClockTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Day separator between messages that are far apart in time. */
export function formatDayHeading(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date(today.getTime() - DAY);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** True when two messages are far enough apart to warrant a date separator. */
export function needsDaySeparator(previous: string | undefined, current: string): boolean {
  if (!previous) return true;

  const previousDate = new Date(previous);
  const currentDate = new Date(current);
  if (Number.isNaN(previousDate.getTime()) || Number.isNaN(currentDate.getTime())) return false;

  return previousDate.toDateString() !== currentDate.toDateString();
}

/** Collapses whitespace so a preview cannot break the sidebar layout. */
export function toPreview(value: string, maxLength = 80): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}
