import { decodeCursor, encodeCursor, fingerprintQuery } from './cursor.util';

describe('cursor.util', () => {
  const query = { conversationId: 'c-1', status: 'active' };
  const fingerprint = fingerprintQuery(query);

  it('produces a stable fingerprint regardless of key order', () => {
    expect(fingerprintQuery({ status: 'active', conversationId: 'c-1' })).toBe(fingerprint);
  });

  it('produces a different fingerprint for a different query', () => {
    expect(fingerprintQuery({ conversationId: 'c-2', status: 'active' })).not.toBe(fingerprint);
  });

  it('round-trips a key and tiebreaker', () => {
    const cursor = encodeCursor('2026-01-01T00:00:00.000Z', 'm-9', fingerprint);
    expect(decodeCursor(cursor, fingerprint)).toEqual({
      key: '2026-01-01T00:00:00.000Z',
      tiebreaker: 'm-9',
      group: null,
    });
  });

  it('round-trips the leading group used by pinned-first listings', () => {
    const cursor = encodeCursor('2026-01-01T00:00:00.000Z', 'c-1', fingerprint, 'true');
    expect(decodeCursor(cursor, fingerprint).group).toBe('true');
  });

  it('omits the group from the payload when none is given', () => {
    const cursor = encodeCursor('k', 't', fingerprint);
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      g?: string;
    };
    expect(payload.g).toBeUndefined();
  });

  it('rejects a cursor whose group is not a string', () => {
    const tampered = Buffer.from(
      JSON.stringify({ k: 'k', t: 't', f: fingerprint, g: 7 }),
      'utf8',
    ).toString('base64url');

    expect(() => decodeCursor(tampered, fingerprint)).toThrow('Malformed pagination cursor');
  });

  it('rejects a cursor minted for a different query', () => {
    const cursor = encodeCursor('k', 't', fingerprint);
    expect(() => decodeCursor(cursor, 'other-fingerprint')).toThrow(
      'Pagination cursor does not belong to this query',
    );
  });

  it('rejects a malformed cursor', () => {
    expect(() => decodeCursor('not-base64-json', fingerprint)).toThrow(
      'Malformed pagination cursor',
    );
    expect(() => decodeCursor(Buffer.from('{"k":1}').toString('base64url'), fingerprint)).toThrow(
      'Malformed pagination cursor',
    );
  });
});
