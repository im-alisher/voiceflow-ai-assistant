import type { AgentStreamEvent } from '@voiceflow/shared';
import type { Response } from 'express';
import { SseWriter } from './sse-writer';

interface FakeResponse {
  readonly status: jest.Mock;
  readonly setHeader: jest.Mock;
  readonly flushHeaders: jest.Mock;
  readonly write: jest.Mock;
  readonly end: jest.Mock;
  writableEnded: boolean;
  destroyed: boolean;
  /** Every `data:` payload written, parsed back into an event. */
  frames(): AgentStreamEvent[];
  raw(): string;
}

function fakeResponse(): FakeResponse {
  const written: string[] = [];

  const response: FakeResponse = {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    end: jest.fn(() => {
      response.writableEnded = true;
      return response;
    }),
    writableEnded: false,
    destroyed: false,
    frames: () =>
      written
        .filter((chunk) => chunk.startsWith('data: '))
        .map((chunk) => JSON.parse(chunk.slice('data: '.length, -2)) as AgentStreamEvent),
    raw: () => written.join(''),
  };

  return response;
}

/**
 * Builds an event stream for the writer.
 *
 * `for await` accepts a plain generator, and the writer's contract is satisfied
 * at runtime; the cast keeps the test free of an async wrapper that would trip
 * `require-await`.
 */
function eventsOf(
  ...events: (AgentStreamEvent | Error)[]
): AsyncGenerator<AgentStreamEvent, void, unknown> {
  function* sync(): Generator<AgentStreamEvent, void, unknown> {
    for (const event of events) {
      if (event instanceof Error) throw event;
      yield event;
    }
  }
  return sync() as unknown as AsyncGenerator<AgentStreamEvent, void, unknown>;
}

const DONE: AgentStreamEvent = {
  type: 'done',
  finishReason: 'stop',
  tokenUsage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
};

describe('SseWriter', () => {
  const writer = new SseWriter();

  afterEach(() => jest.useRealTimers());

  it('sets the headers a proxy needs to stream rather than buffer', async () => {
    const response = fakeResponse();
    await writer.stream(response as unknown as Response, eventsOf(DONE));

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(response.flushHeaders).toHaveBeenCalled();
  });

  it('frames each event as a single-line SSE message', async () => {
    const response = fakeResponse();
    await writer.stream(
      response as unknown as Response,
      eventsOf(
        { type: 'meta', conversationId: 'c1', model: 'm', providerId: 'p' },
        { type: 'delta', delta: 'hi' },
        DONE,
      ),
    );

    expect(response.raw()).toContain('data: {"type":"delta","delta":"hi"}\n\n');
    // A multi-line payload would terminate the frame early.
    expect(
      response
        .raw()
        .split('\n\n')
        .filter((line) => line !== ''),
    ).toHaveLength(3);
  });

  it('synthesises a terminal frame when the generator ends without one', async () => {
    const response = fakeResponse();
    await writer.stream(
      response as unknown as Response,
      eventsOf({ type: 'delta', delta: 'partial' }),
    );

    // Without this the client would wait on a `done` that never arrives.
    expect(response.frames().at(-1)?.type).toBe('done');
  });

  it('reports a thrown generator as a terminal error frame', async () => {
    const response = fakeResponse();
    await writer.stream(
      response as unknown as Response,
      eventsOf({ type: 'delta', delta: 'partial' }, new Error('boom')),
    );

    const frames = response.frames();
    expect(frames.at(-1)?.type).toBe('error');
    expect(response.end).toHaveBeenCalled();
  });

  it('emits a comment heartbeat so an idle proxy does not drop the connection', async () => {
    jest.useFakeTimers();
    const response = fakeResponse();

    const pending = writer.stream(response as unknown as Response, eventsOf(DONE));
    jest.advanceTimersByTime(16_000);
    await pending;

    expect(response.raw()).toContain(': ping');
  });

  it('stops writing once the client has disconnected', async () => {
    const response = fakeResponse();
    response.destroyed = true;

    await writer.stream(
      response as unknown as Response,
      eventsOf({ type: 'delta', delta: 'hi' }, DONE),
    );

    expect(response.write).not.toHaveBeenCalled();
    // No `end()` either: the socket is already gone.
    expect(response.end).not.toHaveBeenCalled();
  });

  it('does not double-finish when the generator already sent done', async () => {
    const response = fakeResponse();
    await writer.stream(
      response as unknown as Response,
      eventsOf({ type: 'error', code: 'AI_PROVIDER_ERROR', message: 'interrupted' }),
    );

    // `error` is already terminal; only one extra frame may be added.
    expect(response.frames().filter((frame) => frame.type === 'done')).toHaveLength(0);
    expect(response.frames()).toHaveLength(1);
  });
});
