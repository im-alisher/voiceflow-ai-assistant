/** Truncates on a word boundary where possible, appending an ellipsis. */
export function truncate(value: string, maxLength: number, suffix = '…'): string {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength - suffix.length);
  const lastSpace = clipped.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${base.trimEnd()}${suffix}`;
}

/** `Ada Lovelace` -> `AL`. Falls back to `?` when there is nothing to use. */
export function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Word-count based token estimate.
 *
 * Deliberately crude: it is only used for budgeting and UI hints, never for
 * billing. Providers report authoritative usage on the completion result.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Collapses whitespace runs so generated titles fit on one line. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Strips markdown/HTML noise before a message is rendered as plain text. */
export function toPlainText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_#>~-]/g, ' ');
}

/** Derives a short, human title from the first user message. */
export function deriveTitleFromMessage(content: string, maxLength = 60): string {
  const firstLine = normalizeWhitespace(toPlainText(content).split(/(?<=[.!?])\s/)[0] ?? '');
  if (!firstLine) return 'New conversation';
  return truncate(firstLine, maxLength);
}
