import type { ConfigService } from '@nestjs/config';
import type { UsersService } from '../users/users.service';
import type { User } from '../users/entities/user.entity';
import type { SessionService, SessionContext } from './services/session.service';
import type { PasswordResetService } from './services/password-reset.service';
import { PasswordService } from './services/password.service';
import type { TokenService } from './services/token.service';
import { AuthService } from './auth.service';
import { AppException } from '../../common/errors';
import type { Clock } from '../../common/utils/clock.util';

/**
 * Fixed clock so expiry assertions are deterministic and never race the wall
 * clock.
 */
const FIXED_NOW = new Date('2026-03-01T12:00:00.000Z');

const clock: Clock = {
  now: () => FIXED_NOW,
  nowMs: () => FIXED_NOW.getTime(),
};

const CONTEXT: SessionContext = {
  userAgent: 'Mozilla/5.0 (unit-test)',
  ipAddress: '203.0.113.10',
};

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ada@voiceflow.local',
    displayName: 'Ada Lovelace',
    passwordHash: '$2a$12$hash',
    role: 'user',
    isActive: true,
    emailVerified: true,
    avatarUrl: null,
    lastLoginAt: null,
    ...overrides,
  } as User;
}

const authUserDto = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ada@voiceflow.local',
  displayName: 'Ada Lovelace',
  role: 'user' as const,
};

/**
 * Every collaborator stub, declared in full.
 *
 * Listing all members matters: a partial interface would make unlisted mocks
 * unreachable at compile time, so an assertion could silently start testing
 * nothing.
 */
interface Harness {
  readonly service: AuthService;
  readonly sessions: {
    open: jest.Mock;
    rotate: jest.Mock<Promise<unknown>, [unknown, string, Date]>;
    revoke: jest.Mock;
    revokeAllForUser: jest.Mock;
    resolve: jest.Mock;
    findById: jest.Mock;
    touch: jest.Mock;
    listForUser: jest.Mock;
  };
  readonly users: {
    findByEmail: jest.Mock;
    findActiveById: jest.Mock;
    findByIdWithPassword: jest.Mock;
    recordLogin: jest.Mock;
    savePasswordHash: jest.Mock;
    create: jest.Mock;
    toAuthDto: jest.Mock;
  };
  readonly tokens: {
    signAccessToken: jest.Mock;
    generateRefreshToken: jest.Mock;
    refreshLifetimeFor: jest.Mock;
  };
  readonly passwords: {
    hash: jest.Mock;
    verify: jest.Mock;
    needsRehash: jest.Mock;
    assertAcceptable: jest.Mock;
  };
  readonly resets: {
    issue: jest.Mock;
    consume: jest.Mock;
  };
}

function createHarness(): Harness {
  const sessions = {
    open: jest.fn().mockResolvedValue(undefined),
    rotate: jest.fn().mockResolvedValue(undefined),
    revoke: jest.fn().mockResolvedValue(undefined),
    revokeAllForUser: jest.fn().mockResolvedValue(3),
    resolve: jest.fn(),
    findById: jest.fn(),
    touch: jest.fn().mockResolvedValue(undefined),
    listForUser: jest.fn().mockResolvedValue([]),
  };

  const users = {
    findByEmail: jest.fn(),
    findActiveById: jest.fn(),
    findByIdWithPassword: jest.fn(),
    recordLogin: jest.fn().mockResolvedValue(undefined),
    savePasswordHash: jest.fn().mockResolvedValue(undefined),
    create: jest.fn(),
    toAuthDto: jest.fn().mockReturnValue(authUserDto),
  };

  const tokens = {
    signAccessToken: jest
      .fn()
      .mockResolvedValue({ token: 'access.jwt', expiresAt: new Date('2026-03-01T12:15:00.000Z') }),
    generateRefreshToken: jest.fn().mockReturnValue('refresh-token-value'),
    refreshLifetimeFor: jest.fn().mockReturnValue(3600),
  };

  const passwords = {
    hash: jest.fn().mockResolvedValue('$2a$12$newHash'),
    verify: jest.fn().mockResolvedValue(true),
    needsRehash: jest.fn().mockReturnValue(false),
    // Mirrors the production guard instead of stubbing it out, so the
    // "reject before hashing" assertions test real behaviour.
    assertAcceptable: jest.fn((plain: string) => {
      if (plain.length > 128) throw AppException.unprocessable('Password is too long');
    }),
  };

  const usersService = {
    findByEmail: users.findByEmail,
    findActiveById: users.findActiveById,
    findByIdWithPassword: users.findByIdWithPassword,
    recordLogin: users.recordLogin,
    savePasswordHash: users.savePasswordHash,
    create: users.create,
    toAuthDto: users.toAuthDto,
  } as unknown as UsersService;

  const sessionService = sessions as unknown as SessionService;
  const tokenService = tokens as unknown as TokenService;
  const passwordService = passwords as unknown as PasswordService;

  const resetService = {
    issue: jest.fn().mockResolvedValue({ raw: 'raw-token', expiresAt: new Date() }),
    consume: jest.fn().mockResolvedValue(undefined),
  };

  const config = {
    getOrThrow: jest.fn().mockReturnValue({ webUrl: 'https://app.voiceflow.test' }),
  } as unknown as ConfigService;

  return {
    service: new AuthService(
      usersService,
      tokenService,
      passwordService,
      sessionService,
      resetService as unknown as PasswordResetService,
      clock,
      config,
    ),
    sessions,
    users,
    tokens,
    passwords,
    resets: resetService,
  };
}

describe('AuthService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('opens a session and returns a token pair for valid credentials', async () => {
      const harness = createHarness();
      harness.users.findByEmail.mockResolvedValue(buildUser());

      const result = await harness.service.login({
        credentials: { email: 'ada@voiceflow.local', password: 'correct horse' },
        context: CONTEXT,
      });

      expect(result.user).toEqual(authUserDto);
      expect(result.tokens.accessToken).toBe('access.jwt');
      expect(result.tokens.tokenType).toBe('Bearer');
      expect(harness.sessions.open).toHaveBeenCalledTimes(1);
      expect(harness.users.recordLogin).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        FIXED_NOW,
      );
    });

    it('rejects an unknown email with the same error as a wrong password', async () => {
      const harness = createHarness();
      harness.users.findByEmail.mockResolvedValue(null);
      harness.passwords.verify.mockResolvedValue(false);

      await expect(
        harness.service.login({
          credentials: { email: 'nobody@voiceflow.local', password: 'whatever' },
          context: CONTEXT,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

      // The hash comparison still runs, so timing cannot distinguish the cases.
      expect(harness.passwords.verify).toHaveBeenCalledWith('whatever', null);
      expect(harness.sessions.open).not.toHaveBeenCalled();
    });

    it('refuses a deactivated account even with a correct password', async () => {
      const harness = createHarness();
      harness.users.findByEmail.mockResolvedValue(buildUser({ isActive: false }));

      await expect(
        harness.service.login({
          credentials: { email: 'ada@voiceflow.local', password: 'correct horse' },
          context: CONTEXT,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      expect(harness.sessions.open).not.toHaveBeenCalled();
    });

    it('upgrades a hash created with a weaker cost', async () => {
      const harness = createHarness();
      harness.users.findByEmail.mockResolvedValue(buildUser());
      harness.passwords.needsRehash.mockReturnValue(true);

      await harness.service.login({
        credentials: { email: 'ada@voiceflow.local', password: 'correct horse' },
        context: CONTEXT,
      });

      expect(harness.users.savePasswordHash).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        '$2a$12$newHash',
      );
    });
  });

  describe('register', () => {
    it('creates the user and immediately opens a session', async () => {
      const harness = createHarness();
      harness.users.create.mockResolvedValue(buildUser({ emailVerified: false }));

      await harness.service.register({
        registration: {
          email: 'grace@voiceflow.local',
          password: 'long-enough-passphrase',
          displayName: 'Grace Hopper',
          acceptedTerms: true,
        },
        context: CONTEXT,
      });

      expect(harness.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'grace@voiceflow.local',
          passwordHash: '$2a$12$newHash',
          displayName: 'Grace Hopper',
          role: 'user',
        }),
      );
      expect(harness.sessions.open).toHaveBeenCalledTimes(1);
    });

    it('rejects an over-long password before hashing it', async () => {
      const harness = createHarness();

      await expect(
        harness.service.register({
          registration: {
            email: 'grace@voiceflow.local',
            password: 'x'.repeat(200),
            displayName: 'Grace Hopper',
            acceptedTerms: true,
          },
          context: CONTEXT,
        }),
      ).rejects.toBeInstanceOf(Error);

      expect(harness.passwords.hash).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the stored token and returns a fresh access token', async () => {
      const harness = createHarness();
      const session = {
        id: 'session-1',
        userId: authUserDto.id,
        rotatedAt: null,
        expiresAt: new Date('2026-03-02T12:00:00.000Z'),
      };

      harness.sessions.resolve.mockResolvedValue(session);
      harness.users.findActiveById.mockResolvedValue(buildUser());

      const result = await harness.service.refresh('presented-token');

      expect(result.tokens.accessToken).toBe('access.jwt');
      expect(harness.sessions.rotate).toHaveBeenCalledWith(
        session,
        'refresh-token-value',
        expect.any(Date),
      );
    });

    it('keeps the original absolute deadline instead of restarting the clock', async () => {
      const harness = createHarness();
      // An extended ("remember me") session: the deadline is far beyond the
      // standard refresh lifetime, so recomputing it would visibly shorten the
      // session on its first refresh.
      const originalExpiry = new Date('2026-04-05T12:00:00.000Z');
      const session = {
        id: 'session-1',
        userId: authUserDto.id,
        rotatedAt: null,
        expiresAt: originalExpiry,
      };

      harness.sessions.resolve.mockResolvedValue(session);
      harness.users.findActiveById.mockResolvedValue(buildUser());

      const result = await harness.service.refresh('presented-token');

      // Neither the stored row nor the advertised expiry may drift.
      expect(harness.sessions.rotate).toHaveBeenCalledWith(
        session,
        'refresh-token-value',
        originalExpiry,
      );
      expect(result.tokens.refreshTokenExpiresAt).toBe(originalExpiry.toISOString());
      expect(harness.tokens.refreshLifetimeFor).not.toHaveBeenCalled();
    });

    it('does not extend the lifetime across repeated refreshes', async () => {
      const harness = createHarness();
      const originalExpiry = new Date('2026-03-02T12:00:00.000Z');

      // Each refresh carries the deadline the previous rotation left behind, so
      // a chain of refreshes converges on the original instant.
      for (const _attempt of [1, 2, 3]) {
        harness.sessions.resolve.mockResolvedValue({
          id: 'session-1',
          userId: authUserDto.id,
          rotatedAt: null,
          expiresAt: originalExpiry,
        });
        harness.users.findActiveById.mockResolvedValue(buildUser());

        await harness.service.refresh('presented-token');
      }

      // Typed by the `rotate` mock's declared call tuple, so a typo in this
      // assertion would be a compile error rather than a silent pass.
      const deadlines = harness.sessions.rotate.mock.calls;
      expect(deadlines).toHaveLength(3);
      for (const [, , deadline] of deadlines) {
        expect(deadline).toEqual(originalExpiry);
      }
    });

    it('revokes the session when the account has since been deactivated', async () => {
      const harness = createHarness();
      const session = { id: 'session-1', userId: authUserDto.id, rotatedAt: null };

      harness.sessions.resolve.mockResolvedValue(session);
      harness.users.findActiveById.mockResolvedValue(null);

      await expect(harness.service.refresh('presented-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });

      expect(harness.sessions.revoke).toHaveBeenCalledWith('session-1');
      expect(harness.sessions.rotate).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('replaces the hash and revokes every session', async () => {
      const harness = createHarness();
      harness.users.findByIdWithPassword.mockResolvedValue(buildUser());

      const result = await harness.service.changePassword(authUserDto.id, {
        currentPassword: 'old passphrase',
        newPassword: 'new passphrase',
      });

      expect(result.revokedSessions).toBe(3);
      expect(harness.sessions.revokeAllForUser).toHaveBeenCalledWith(authUserDto.id);
    });

    it('rejects when the current password is wrong', async () => {
      const harness = createHarness();
      harness.users.findByIdWithPassword.mockResolvedValue(buildUser());
      harness.passwords.verify.mockResolvedValue(false);

      await expect(
        harness.service.changePassword(authUserDto.id, {
          currentPassword: 'wrong',
          newPassword: 'new passphrase',
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

      expect(harness.sessions.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('revokeSession', () => {
    it('refuses to revoke a session belonging to another user', async () => {
      const harness = createHarness();
      harness.sessions.findById.mockResolvedValue({ id: 'session-9', userId: 'someone-else' });

      await expect(
        harness.service.revokeSession(authUserDto.id, 'session-9'),
      ).rejects.toBeInstanceOf(AppException);

      // Reported as missing rather than forbidden, so the endpoint cannot be
      // used to probe which session ids exist.
      expect(harness.sessions.revoke).not.toHaveBeenCalled();
    });

    it("revokes the caller's own session, signing them out", async () => {
      const harness = createHarness();
      harness.sessions.findById.mockResolvedValue({ id: 'session-1', userId: authUserDto.id });

      await harness.service.revokeSession(authUserDto.id, 'session-1');

      expect(harness.sessions.revoke).toHaveBeenCalledWith('session-1');
    });
  });

  describe('requestPasswordReset', () => {
    it('issues a token for a registered address', async () => {
      const harness = createHarness();
      harness.users.findByEmail.mockResolvedValue(buildUser());

      await expect(harness.service.requestPasswordReset('ada@voiceflow.local')).resolves.toBe(true);
      expect(harness.resets.issue).toHaveBeenCalledWith(
        expect.objectContaining({ userId: expect.any(String) as string }),
      );
    });

    it('sends nothing for an unknown address', async () => {
      const harness = createHarness();
      harness.users.findByEmail.mockResolvedValue(null);

      await expect(harness.service.requestPasswordReset('unknown@voiceflow.local')).resolves.toBe(
        false,
      );
      expect(harness.resets.issue).not.toHaveBeenCalled();
    });

    it('still spends a password comparison for an unknown address', async () => {
      // Otherwise the two branches differ in cost, and the difference is
      // exactly what an enumeration attack measures.
      const harness = createHarness();
      harness.users.findByEmail.mockResolvedValue(null);

      await harness.service.requestPasswordReset('unknown@voiceflow.local');

      expect(harness.passwords.verify).toHaveBeenCalledWith('', null);
    });

    it('sends nothing for a deactivated account', async () => {
      const harness = createHarness();
      harness.users.findByEmail.mockResolvedValue({ ...buildUser(), isActive: false });

      await expect(harness.service.requestPasswordReset('ada@voiceflow.local')).resolves.toBe(
        false,
      );
      expect(harness.resets.issue).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('forwards the token to the reset service', async () => {
      const harness = createHarness();

      await harness.service.resetPassword({
        token: 'raw',
        newPassword: 'a-long-enough-passphrase',
      });

      expect(harness.resets.consume).toHaveBeenCalledWith({
        rawToken: 'raw',
        newPassword: 'a-long-enough-passphrase',
      });
    });
  });
});

describe('PasswordService', () => {
  it('compares against a dummy hash when no user matches', async () => {
    const compare = jest.fn().mockResolvedValue(false);
    const service = new PasswordService({ hash: jest.fn(), compare, needsRehash: jest.fn() }, {
      getOrThrow: () => ({ bcryptSaltRounds: 12 }),
    } as never);

    await expect(service.verify('guess', null)).resolves.toBe(false);
    expect(compare).toHaveBeenCalledTimes(1);
  });
});
