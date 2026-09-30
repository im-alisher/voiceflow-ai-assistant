/**
 * Opaque, tamper-evident cursor pagination.
 *
 * The cursor is base64url-encoded JSON containing the sort key of the last row
 * plus a fingerprint of the query it was produced for. The fingerprint stops a
 * cursor from one filter being replayed against another (which would otherwise
 * silently return a nonsense page).
 */
import { createHash } from 'node:crypto';

interface CursorPayload {
  /** Value of the sort column on the last returned row. */
  readonly k: string;
  /** Primary key tiebreaker — the only thing that makes ordering total. */
  readonly t: string;
  /** Hash of the query shape. */
  readonly f: string;
}

export function fingerprintQuery(parts: Readonly<Record<string, unknown>>): string {
  const normalized = Object.keys(parts)
    .filter((key) => parts[key] !== undefined)
    .sort()
    .map((key) => `${key}=${String(parts[key])}`)
    .join('&');
  return createHash('sha256').update(normalized).digest('base64url').slice(0, 12);
}

export function encodeCursor(
  key: string | Date,
  tiebreaker: string,
  queryFingerprint: string,
): string {
  const payload: CursorPayload = {
    k: key instanceof Date ? key.toISOString() : key,
    t: tiebreaker,
    f: queryFingerprint,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(
  cursor: string,
  queryFingerprint: string,
): { key: string; tiebreaker: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed pagination cursor');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Malformed pagination cursor');
  }

  const { k, t, f } = parsed as CursorPayload;
  if (typeof k !== 'string' || typeof t !== 'string' || typeof f !== 'string') {
    throw new Error('Malformed pagination cursor');
  }
  if (f !== queryFingerprint) {
    throw new Error('Pagination cursor does not belong to this query');
  }

  return { key: k, tiebreaker: t };
}
