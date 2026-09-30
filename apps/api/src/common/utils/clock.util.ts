export interface Clock {
  now(): Date;
  nowMs(): number;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowMs: () => Date.now(),
};

export interface IdGenerator {
  uuid(): string;
  /** Short, URL-safe token used for refresh tokens and idempotency keys. */
  opaqueToken(byteLength?: number): string;
}
