import { Injectable, Logger } from '@nestjs/common';
import type { AgentStreamEvent } from '@voiceflow/shared';
import type { Response } from 'express';

const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Writes `AgentStreamEvent`s to the client as server-sent events.
 *
 * Three details make this reliable rather than merely plausible:
 *
 *  - **Nginx-style buffering is disabled** on the response, otherwise a
 *    reverse proxy holds every frame until the stream closes and the user sees
 *    one long pause instead of a token-by-token reply.
 *  - **A heartbeat comment is emitted while waiting.** Idle SSE connections are
 *    dropped by many proxies after 30–60s; a comment frame is ignored by
 *    `EventSource` but keeps the socket warm.
 *  - **A terminal frame is always sent**, even after a disconnect, so the
 *    client is never left waiting for a `done` that cannot arrive.
 */
@Injectable()
export class SseWriter {
  private readonly logger = new Logger(SseWriter.name);

  async stream(
    response: Response,
    events: AsyncGenerator<AgentStreamEvent, void, unknown>,
  ): Promise<void> {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    // Defeats proxy buffering; harmless when absent.
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const heartbeat = setInterval(() => {
      // A comment frame: ignored by `EventSource`, but keeps the pipe open.
      response.write(': ping\n\n');
    }, HEARTBEAT_INTERVAL_MS);
    // Never hold the event loop open just for a heartbeat.
    heartbeat.unref?.();

    let sawTerminalFrame = false;

    try {
      for await (const event of events) {
        if (isClosed(response)) break;
        if (event.type === 'done' || event.type === 'error') sawTerminalFrame = true;
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      // A generator that returned without a terminal frame would leave the
      // client awaiting a `done` forever; synthesise one rather than hang.
      if (!sawTerminalFrame && !isClosed(response)) {
        response.write(`data: ${JSON.stringify(IMPLICIT_DONE)}\n\n`);
      }
    } catch (error) {
      this.logger.warn(
        `SSE stream aborted: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      // The generator threw, so it never got to emit its own terminal frame.
      // Sending one keeps the promise made above; if the socket is already gone
      // the write is skipped rather than throwing a second error.
      if (!isClosed(response)) {
        response.write(`data: ${JSON.stringify(INTERRUPTED)}\n\n`);
      }
    } finally {
      clearInterval(heartbeat);
      // Ends the response even on an early `break`, so the client sees a closed
      // stream instead of a stalled connection.
      if (!isClosed(response)) response.end();
    }
  }
}

/** True once the response is finished, or torn down by a disconnected client. */
function isClosed(response: Response): boolean {
  return response.writableEnded || response.destroyed;
}

/** Terminal frame used when the generator finished without emitting `done`. */
const IMPLICIT_DONE: AgentStreamEvent = {
  type: 'done',
  finishReason: 'stop',
  tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
};

/** Terminal frame used when the generator threw before it could finish. */
const INTERRUPTED: AgentStreamEvent = {
  type: 'error',
  code: 'AI_PROVIDER_ERROR',
  message: 'The assistant response was interrupted',
};
