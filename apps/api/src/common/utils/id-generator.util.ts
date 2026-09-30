import { randomBytes, randomUUID } from 'node:crypto';
import type { IdGenerator } from './clock.util';

/** Default `IdGenerator` backed by Node's CSPRNG. */
export const systemIdGenerator: IdGenerator = {
  uuid: () => randomUUID(),
  opaqueToken: (byteLength = 48) => randomBytes(byteLength).toString('base64url'),
};
