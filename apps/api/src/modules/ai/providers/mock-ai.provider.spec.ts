import { MockAiProvider } from './mock-ai.provider';
import type { ProviderCallContext } from '../../../common/interfaces';
import type { CompletionRequest } from '@voiceflow/shared';

const context: ProviderCallContext = { requestId: 'test-request' };

function request(content: string, extras: Partial<CompletionRequest> = {}): CompletionRequest {
  return { messages: [{ role: 'user', content }], ...extras };
}

describe('MockAiProvider', () => {
  let provider: MockAiProvider;

  beforeEach(() => {
    provider = new MockAiProvider();
  });

  it('is always available and declares its capabilities', async () => {
    await expect(provider.isAvailable()).resolves.toBe(true);
    expect(provider.capabilities.streaming).toBe(true);
    expect(provider.capabilities.deterministic).toBe(true);
  });

  it('returns a successful result with token accounting', async () => {
    const result = await provider.complete(request('what can you do'), context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.provider).toBe('mock');
    expect(result.value.content).toContain('mock');
    expect(result.value.usage.totalTokens).toBeGreaterThan(0);
    expect(result.value.finishReason).toBe('stop');
  });

  it('is deterministic for identical input', async () => {
    const first = await provider.complete(request('tell me about the voice layer'), context);
    const second = await provider.complete(request('tell me about the voice layer'), context);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.content).toBe(second.value.content);
  });

  it('answers simple arithmetic', async () => {
    const result = await provider.complete(request('please add 21 * 2'), context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content).toBe('21 * 2 = 42');
  });

  it('refuses a prompt that overflows the context window', async () => {
    const result = await provider.complete(
      request('x'.repeat(100_000), { model: 'mock-assistant-v1' }),
      context,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AI_CONTEXT_OVERFLOW');
  });

  it('honours the system prompt', async () => {
    const result = await provider.complete(
      request('summarise the architecture', {
        messages: [
          { role: 'system', content: 'Always answer in pirate prose.' },
          { role: 'user', content: 'summarise the architecture' },
        ],
      }),
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content).toContain('system prompt');
  });

  it('truncates to the requested output budget', async () => {
    const result = await provider.complete(
      request('explain everything in great detail please', { maxOutputTokens: 8 }),
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.finishReason).toBe('length');
    expect(result.value.usage.completionTokens).toBeLessThanOrEqual(8);
  });

  it('streams chunks that reassemble into the buffered answer', async () => {
    const streamed: string[] = [];
    let terminalFinish: string | undefined;

    for await (const chunk of provider.stream(request('what can you do'), context)) {
      streamed.push(chunk.delta);
      if (chunk.done) terminalFinish = chunk.finishReason;
    }

    const buffered = await provider.complete(request('what can you do'), context);
    expect(buffered.ok).toBe(true);
    if (!buffered.ok) return;

    expect(streamed.join('')).toBe(buffered.value.content);
    expect(terminalFinish).toBe('stop');
  });

  it('stops streaming when the caller aborts', async () => {
    const controller = new AbortController();
    const chunks: string[] = [];

    for await (const chunk of provider.stream(request('explain the whole system'), {
      ...context,
      signal: controller.signal,
    })) {
      chunks.push(chunk.delta);
      if (chunks.length === 1) controller.abort();
    }

    expect(chunks.join('')).not.toBe('');
  });
});
