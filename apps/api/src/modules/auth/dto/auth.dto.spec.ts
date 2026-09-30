import { HttpException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../../validation-pipe-options';
import { RegisterDto } from './auth.dto';

/**
 * The registration payload the browser actually sends, per
 * `packages/shared/src/schemas/auth.schema.ts`.
 */
function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    email: 'ada@voiceflow.local',
    password: 'correct horse battery',
    displayName: 'Ada Lovelace',
    acceptedTerms: true,
    ...overrides,
  };
}

describe('RegisterDto', () => {
  // The real pipe, with the real options. Testing `validateSync` directly would
  // not exercise whitelisting, so an unknown field could appear to be stripped
  // when the running application would in fact reject the request.
  const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);
  const metadata: ArgumentMetadata = { type: 'body', metatype: RegisterDto };

  /** The `message` array the exception factory reports back to the client. */
  async function rejectionFor(body: Record<string, unknown>): Promise<string[]> {
    try {
      await pipe.transform(body, metadata);
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'message' in response) {
          const { message } = response;
          if (Array.isArray(message)) return message.map(String);
        }
      }
      throw error;
    }
    throw new Error('Expected the payload to be rejected, but validation passed');
  }

  it('accepts the exact payload the shared schema produces', async () => {
    await expect(pipe.transform(payload(), metadata)).resolves.toMatchObject({
      email: 'ada@voiceflow.local',
      displayName: 'Ada Lovelace',
      acceptedTerms: true,
    });
  });

  it('rejects a request that declines the terms', async () => {
    await expect(rejectionFor(payload({ acceptedTerms: false }))).resolves.toEqual(
      expect.arrayContaining([expect.stringMatching(/terms/i)]),
    );
  });

  it('rejects a request that omits the terms entirely', async () => {
    const messages = await rejectionFor(payload({ acceptedTerms: undefined }));
    expect(messages).toEqual(expect.arrayContaining([expect.stringMatching(/terms/i)]));
  });

  it('refuses a privilege-escalation attempt in the body', async () => {
    const messages = await rejectionFor(payload({ isAdmin: true, role: 'admin' }));
    expect(messages).toEqual(expect.arrayContaining(['property isAdmin should not exist']));
  });

  it('never exposes a field it did not validate', async () => {
    const result = (await pipe.transform(payload(), metadata)) as Record<string, unknown>;

    // `locale` has a default; nothing else may appear.
    expect(Object.keys(result).sort()).toEqual([
      'acceptedTerms',
      'displayName',
      'email',
      'locale',
      'password',
    ]);
    expect(result).not.toHaveProperty('passwordHash');
  });
});
