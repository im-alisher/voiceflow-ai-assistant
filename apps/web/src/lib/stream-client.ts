import type { AgentStreamEvent } from '@voiceflow/shared';
import { NetworkError, toApiError } from '@/lib/api-client';
import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/auth-store';

export interface StreamOptions {
  readonly body: unknown;
  readonly signal?: AbortSignal;
  /** Called for every frame the server sends, in order. */
  readonly onEvent: (event: AgentStreamEvent) => void;
  /**
   * Must exceed the provider's worst-case latency. The shared client's 30s
   * timeout exists for JSON calls and would cut a slow answer in half.
   */
  readonly timeoutMs?: number;
}

const DEFAULT_STREAM_TIMEOUT_MS = 120_000;

/**
 * Streams `AgentStreamEvent`s from the assistant endpoint.
 *
 * `EventSource` cannot send an `Authorization` header and cannot issue a POST,
 * so the stream is read from a `fetch` body instead.
 *
 * Frames arrive as bare `data:` lines separated by a blank line, with no event
 * name, so dispatch happens on the `type` field of the decoded payload. Comment
 * frames (`: ping`) are heartbeats and are ignored.
 */
export async function streamAgentEvents(path: string, options: StreamOptions): Promise<void> {
  const url = `${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'X-Api-Version': '1',
  };

  const token = useAuthStore.getState().accessToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(options.body),
      signal,
    });
  } catch (error) {
    // An abort the caller asked for is theirs to handle, not a network fault.
    if (options.signal?.aborted) throw error;
    throw new NetworkError();
  }

  if (!response.ok) {
    throw toApiError(response.status, await readErrorBody(response));
  }

  if (!response.body) {
    throw new NetworkError('The server returned an empty stream');
  }

  for await (const frame of readFrames(response.body)) {
    options.onEvent(frame);
  }
}

/**
 * Decodes an SSE body into event payloads.
 *
 * Chunk boundaries fall wherever the network puts them, so a partial frame has
 * to be carried into the next read rather than parsed and lost.
 */
async function* readFrames(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentStreamEvent, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const event = parseFrame(frame);
        if (event) yield event;

        boundary = buffer.indexOf('\n\n');
      }
    }

    // A stream cut short can still carry a final frame without a trailing gap.
    const trailing = parseFrame(buffer);
    if (trailing) yield trailing;
  } finally {
    // Releases the socket even when the consumer stopped early.
    reader.releaseLock();
  }
}

/** Returns the payload of one `data:` frame, or null for comments and blanks. */
function parseFrame(frame: string): AgentStreamEvent | null {
  const payload = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('\n');

  // A heartbeat comment, or a frame the server has not finished writing.
  if (!payload) return null;

  try {
    return JSON.parse(payload) as AgentStreamEvent;
  } catch {
    return null;
  }
}

async function readErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
