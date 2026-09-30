import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AppException, PASSWORD_HASHER } from '../../../common';
import { CONFIG_NAMESPACE, type AuthConfig } from '../../../config';
import type { PasswordHasher } from './password-hasher.interface';

/**
 * Pre-computed hash of a value no user can submit.
 *
 * Verifying against it when no user row exists keeps the failure path the same
 * cost as the success path, so response timing cannot be used to enumerate
 * registered addresses.
 */
const DUMMY_HASH = '$2a$12$Q9Z0J1cXcYbR4d1Vb0hSke4V0k1yZ8bH3nqP2rT6uW7oK5lM9aJ2S';

/**
 * Default `PasswordHasher` implementation.
 *
 * Bound to the `PASSWORD_HASHER` token rather than injected as a concrete class
 * so a test can substitute a fast, deterministic hasher and keep the auth suite
 * fast enough to run on every commit.
 */
export const BCRYPT_PASSWORD_HASHER: PasswordHasher = {
  hash(plain: string, saltRounds: number): Promise<string> {
    return bcrypt.hash(plain, saltRounds);
  },
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  },
  needsRehash(hash: string, saltRounds: number): boolean {
    const cost = Number.parseInt(hash.split('$')[2] ?? '', 10);
    return Number.isNaN(cost) || cost < saltRounds;
  },
};

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    config: ConfigService,
  ) {
    this.saltRounds = config.getOrThrow<AuthConfig>(CONFIG_NAMESPACE.AUTH).bcryptSaltRounds;
  }

  hash(plain: string): Promise<string> {
    return this.hasher.hash(plain, this.saltRounds);
  }

  /**
   * Verifies a password, padding the unknown-user case so the timing profile
   * of "no such user" matches "wrong password".
   */
  async verify(plain: string, hash: string | null): Promise<boolean> {
    if (hash) return this.hasher.compare(plain, hash);
    await this.hasher.compare(plain, DUMMY_HASH);
    return false;
  }

  needsRehash(hash: string): boolean {
    return this.hasher.needsRehash(hash, this.saltRounds);
  }

  /**
   * Guards the service API against unbounded input; the DTO bounds it too, but
   * a hash is deliberately expensive so it must never be sized by the caller.
   */
  assertAcceptable(plain: string): void {
    if (plain.length > 128) {
      throw AppException.unprocessable('Password is too long');
    }
  }
}
