import { maskSecrets, REDACTED, serializeError } from './redact';

describe('redact', () => {
  it('redacts sensitive keys at any depth', () => {
    const result = maskSecrets({
      email: 'ada@voiceflow.local',
      password: 'Str0ngPassphrase',
      nested: { refreshToken: 'abc', keep: 'visible' },
    });

    expect(result).toEqual({
      email: 'ada@voiceflow.local',
      password: REDACTED,
      nested: { refreshToken: REDACTED, keep: 'visible' },
    });
  });

  it('redacts credentials embedded in free text', () => {
    const result = maskSecrets('Authorization: Bearer eyJhbGciOi.abc.def');

    expect(result).not.toContain('eyJhbGciOi.abc.def');
    expect(result).toContain(REDACTED);
  });

  it('redacts key=value secrets inside a message', () => {
    const result = maskSecrets('connecting with password=hunter2 to db');

    expect(result).not.toContain('hunter2');
  });

  it('leaves arrays and primitives intact', () => {
    expect(maskSecrets([1, 'two', true])).toEqual([1, 'two', true]);
    expect(maskSecrets(null)).toBeNull();
  });

  it('serialises a non-Error throwable', () => {
    expect(serializeError('boom')).toEqual({ name: 'NonError', message: 'boom' });
  });

  it('keeps the stack of a real Error', () => {
    const serialised = serializeError(new TypeError('bad type'));
    expect(serialised.name).toBe('TypeError');
    expect(serialised.message).toBe('bad type');
    expect(serialised.stack).toContain('TypeError');
  });
});
