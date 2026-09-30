import { Injectable, type LoggerService } from '@nestjs/common';
import { maskSecrets, serializeError } from './redact';

/**
 * Structured application logger.
 *
 * Wraps Nest's `ConsoleLogger` so that call sites depend on an injectable
 * service rather than a global singleton, which keeps them unit-testable and
 * makes the eventual swap to a dedicated transport (pino, Winston, Datadog)
 * a single-file change.
 *
 * Two output modes, chosen by `LOG_PRETTY`:
 *  - pretty  — human readable, one line per event (development)
 *  - json    — one JSON object per event (staging / production, log shippers)
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly pretty: boolean;

  constructor(private readonly context: string, pretty = true) {
    this.pretty = pretty;
  }

  /** Derives a namespaced logger, e.g. `AppLogger` -> `AppLogger:UsersService`. */
  child(suffix: string): AppLogger {
    return new AppLogger(`${this.context}:${suffix}`, this.pretty);
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  info(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    if (message instanceof Error) {
      this.emit('error', serializeError(message, this.pretty), context ?? stackOrContext);
      return;
    }
    this.write('error', message, context ?? stackOrContext);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  private write(level: string, message: unknown, context?: string): void {
    const resolvedContext = context ?? this.context;
    if (this.pretty) {
      const text = typeof message === 'string' ? message : JSON.stringify(message);
      // eslint-disable-next-line no-console
      console.log(`[${level.toUpperCase()}] [${resolvedContext}] ${text}`);
      return;
    }
    this.emit(level, maskSecrets(message), resolvedContext);
  }

  private emit(level: string, payload: unknown, context: string | undefined): void {
    const entry = {
      level,
      time: new Date().toISOString(),
      context: context ?? this.context,
      ...(typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : { msg: String(payload) }),
    };
    // Structured sinks consume a single line of JSON per event.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }
}
