import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { AppException, CLOCK } from '../../../common';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { PasswordResetService, hashToken } from './password-reset.service';

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');

/** Mirrors the columns the service writes; enough to assert on, nothing more. */
interface StoredToken {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
}

interface ResetMail {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly resetUrl: string;
  readonly ttlMinutes: number;
}

interface Builder {
  update: jest.Mock<Builder, [unknown]>;
  set: jest.Mock<Builder, [Record<string, unknown>]>;
  where: jest.Mock<Builder, [string, Record<string, unknown>]>;
  andWhere: jest.Mock<Builder, [string]>;
  execute: jest.Mock<Promise<{ affected: number }>, []>;
}

function makeBuilder(): Builder {
  const builder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn(() => Promise.resolve({ affected: 0 })),
  };

  builder.update.mockReturnValue(builder);
  builder.set.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);

  return builder;
}

describe('PasswordResetService', () => {
  const tokens = {
    createQueryBuilder: jest.fn(() => makeBuilder()),
    create: jest.fn((values: StoredToken) => values),
    save: jest.fn((entity: StoredToken) => Promise.resolve(entity)),
    findOne: jest.fn(() => Promise.resolve<StoredToken | null>(null)),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
    delete: jest.fn(() => Promise.resolve({ affected: 1 })),
  };
  const users = {
    findActiveById: jest.fn(() => Promise.resolve<{ id: string } | null>(null)),
    savePasswordHash: jest.fn(() => Promise.resolve()),
  };
  const passwords = {
    hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
    assertAcceptable: jest.fn(),
  };
  const sessions = { revokeAllForUser: jest.fn(() => Promise.resolve()) };
  const mail = {
    sendPasswordReset: jest.fn((_input: ResetMail) => Promise.resolve(true)),
  };

  let service: PasswordResetService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mail.sendPasswordReset.mockResolvedValue(true);
    users.findActiveById.mockResolvedValue({ id: 'user-1' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: getRepositoryToken(PasswordResetToken), useValue: tokens },
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
        { provide: SessionService, useValue: sessions },
        { provide: MailService, useValue: mail },
        { provide: CLOCK, useValue: { now: () => FIXED_NOW } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'auth' ? { passwordResetTtlMinutes: 60 } : undefined),
          },
        },
      ],
    })
      .setLogger({
        log: () => undefined,
        error: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        verbose: () => undefined,
      })
      .compile();

    service = moduleRef.get(PasswordResetService);
  });

  describe('issue', () => {
    it('stores only a digest of the token and mails the raw value', async () => {
      await service.issue({
        userId: 'user-1',
        email: 'ada@voiceflow.local',
        displayName: 'Ada',
        resetUrlBase: 'http://localhost:5173/reset-password',
      });

      const stored = tokens.save.mock.calls[0]![0];
      expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      const mailed = mail.sendPasswordReset.mock.calls[0]![0];
      const mailedRaw = mailed.resetUrl.split('token=')[1]!;
      expect(stored.tokenHash).not.toBe(mailedRaw);
      expect(stored.tokenHash).toBe(hashToken(decodeURIComponent(mailedRaw)));
      expect(stored.userId).toBe('user-1');
      expect(stored.expiresAt).toEqual(new Date('2026-01-01T01:00:00.000Z'));
    });

    it('revokes any outstanding token so only the newest one works', async () => {
      const builder = makeBuilder();
      tokens.createQueryBuilder.mockReturnValue(builder);
      await service.issue({
        userId: 'user-1',
        email: 'ada@voiceflow.local',
        displayName: 'Ada',
        resetUrlBase: 'http://localhost:5173/reset-password',
      });

      expect(builder.update).toHaveBeenCalledWith(PasswordResetToken);
      expect(builder.where).toHaveBeenCalledWith('user_id = :userId', { userId: 'user-1' });
    });

    it('puts the token in the query string of the mailed link', async () => {
      await service.issue({
        userId: 'user-1',
        email: 'ada@voiceflow.local',
        displayName: 'Ada',
        resetUrlBase: 'http://localhost:5173/reset-password',
      });

      const message = mail.sendPasswordReset.mock.calls[0]![0];
      expect(message.resetUrl).toMatch(/^http:\/\/localhost:5173\/reset-password\?token=[\w-]+$/);
      expect(message.ttlMinutes).toBe(60);
    });

    it('deletes the token when delivery fails, leaving nothing redeemable', async () => {
      mail.sendPasswordReset.mockResolvedValue(false);

      const issued = await service.issue({
        userId: 'user-1',
        email: 'ada@voiceflow.local',
        displayName: 'Ada',
        resetUrlBase: 'http://localhost:5173/reset-password',
      });

      expect(tokens.delete).toHaveBeenCalledWith({
        userId: 'user-1',
        tokenHash: hashToken(issued.raw),
      });
    });
  });

  describe('consume', () => {
    it('changes the password, spends the token, and revokes every session', async () => {
      const raw = 'a'.repeat(43);
      tokens.findOne.mockResolvedValue(usableToken(raw));

      await service.consume({ rawToken: raw, newPassword: 'correct horse battery' });

      expect(passwords.assertAcceptable).toHaveBeenCalledWith('correct horse battery');
      expect(users.savePasswordHash).toHaveBeenCalledWith('user-1', 'hashed:correct horse battery');
      expect(tokens.update).toHaveBeenCalledWith(
        { id: 'token-1' },
        { usedAt: FIXED_NOW, revokedAt: FIXED_NOW },
      );
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('rejects an unknown token without touching the password', async () => {
      tokens.findOne.mockResolvedValue(null);

      await expect(
        service.consume({ rawToken: 'unknown', newPassword: 'correct horse battery' }),
      ).rejects.toBeInstanceOf(AppException);
      expect(users.savePasswordHash).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      const raw = 'b'.repeat(43);
      tokens.findOne.mockResolvedValue(usableToken(raw, new Date('2025-12-31T23:00:00.000Z')));

      await expect(
        service.consume({ rawToken: raw, newPassword: 'correct horse battery' }),
      ).rejects.toThrow(/invalid or has expired/i);
      expect(users.savePasswordHash).not.toHaveBeenCalled();
    });

    it('rejects a token that was already used', async () => {
      const raw = 'c'.repeat(43);
      const token = usableToken(raw);
      (token as { usedAt: Date | null }).usedAt = new Date('2025-12-31T00:00:00.000Z');

      await expect(
        service.consume({ rawToken: raw, newPassword: 'correct horse battery' }),
      ).rejects.toThrow(/invalid or has expired/i);
    });

    it('revokes the token when the account is no longer active', async () => {
      const raw = 'd'.repeat(43);
      tokens.findOne.mockResolvedValue(usableToken(raw));
      users.findActiveById.mockResolvedValue(null);

      await expect(
        service.consume({ rawToken: raw, newPassword: 'correct horse battery' }),
      ).rejects.toThrow(/invalid or has expired/i);
      expect(tokens.update).toHaveBeenCalledWith({ id: 'token-1' }, { revokedAt: FIXED_NOW });
      expect(users.savePasswordHash).not.toHaveBeenCalled();
    });

    it('gives the same message for every rejection so a digest leaks no state', async () => {
      const raw = 'e'.repeat(43);
      tokens.findOne.mockResolvedValue(null);
      const unknown = await service
        .consume({ rawToken: raw, newPassword: 'correct horse battery' })
        .catch((error: Error) => error.message);

      tokens.findOne.mockResolvedValue(usableToken(raw, new Date('2020-01-01T00:00:00.000Z')));
      const expired = await service
        .consume({ rawToken: raw, newPassword: 'correct horse battery' })
        .catch((error: Error) => error.message);

      expect(unknown).toBe(expired);
    });
  });
});

function usableToken(raw: string, expiresAt = new Date('2026-01-01T01:00:00.000Z')) {
  return {
    id: 'token-1',
    userId: 'user-1',
    tokenHash: hashToken(raw),
    expiresAt,
    usedAt: null,
    revokedAt: null,
    isUsableAt: (now: Date) => now < expiresAt,
  };
}
