import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AuthSessionDto,
  AuthTokensDto,
  AuthUserDto,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from '@voiceflow/shared';
import { WEB_ROUTES } from '@voiceflow/shared';
import { ConfigService } from '@nestjs/config';
import { AppException, CLOCK, type Clock } from '../../common';
import { CONFIG_NAMESPACE, type AppConfig } from '../../config';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  SessionService,
  type SessionContext,
  type SessionSummary,
} from './services/session.service';
import { PasswordService } from './services/password.service';
import { PasswordResetService } from './services/password-reset.service';
import { TokenService } from './services/token.service';

/** Credentials plus the request metadata captured for the session record. */
export interface CredentialAttempt {
  readonly credentials: LoginInput;
  readonly context: SessionContext;
}

export interface RegistrationAttempt {
  readonly registration: RegisterInput;
  readonly context: SessionContext;
}

/**
 * Orchestrates authentication concerns.
 *
 * Scoped narrowly: credential verification and session lifecycle live here,
 * while token *cryptography* lives in `TokenService`, password *hashing* in
 * `PasswordService`, and cookie mechanics in `AuthCookieService`. None of those
 * know about HTTP, which keeps this class testable without a request object.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly resets: PasswordResetService,
    @Inject(CLOCK) private readonly clock: Clock,
    config: ConfigService,
  ) {
    this.resetUrlBase = `${config.getOrThrow<AppConfig>(CONFIG_NAMESPACE.APP).webUrl}${WEB_ROUTES.resetPassword}`;
  }

  /**
   * Where the emailed reset link points.
   *
   * A web origin, because the link is followed by a human in a browser. It is
   * read from configuration rather than guessed, so a deployment behind a
   * different host still produces a working link.
   */
  private readonly resetUrlBase: string;

  /**
   * Verifies credentials and opens a session.
   *
   * Failure is deliberately undifferentiated — unknown address and wrong
   * password produce the same error — and `PasswordService.verify` still runs a
   * comparison against a dummy hash when no user matches, so the two cases also
   * take comparable time and cannot be told apart by someone enumerating
   * registered addresses.
   */
  async login({ credentials, context }: CredentialAttempt): Promise<AuthSessionDto> {
    const user = await this.users.findByEmail(credentials.email, { withPassword: true });

    const passwordMatches = await this.passwords.verify(
      credentials.password,
      user?.passwordHash ?? null,
    );

    if (!user || !passwordMatches) {
      throw AppException.unauthorized('Incorrect email or password');
    }

    if (!user.isActive) {
      throw AppException.forbidden('This account has been deactivated');
    }

    // Opportunistic upgrade: a hash created with a lower cost than the current
    // policy is silently rehashed on the next successful sign-in.
    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.users.savePasswordHash(user.id, await this.passwords.hash(credentials.password));
    }

    await this.users.recordLogin(user.id, this.clock.now());

    return this.startSession(user, credentials.rememberMe === true, context);
  }

  /**
   * Creates an account and signs it in.
   *
   * Registration implies a session; making a brand-new user sign in again is pure
   * friction. A duplicate address surfaces as `CONFLICT` from the unique index
   * rather than a pre-flight check, so a concurrent signup cannot slip through
   * the gap between check and insert.
   */
  async register({ registration, context }: RegistrationAttempt): Promise<AuthSessionDto> {
    this.passwords.assertAcceptable(registration.password);

    const user = await this.users.create({
      email: registration.email,
      passwordHash: await this.passwords.hash(registration.password),
      displayName: registration.displayName,
      role: 'user',
    });

    return this.startSession(user, false, context);
  }

  /**
   * Exchanges a refresh token for a new pair, rotating the stored token.
   *
   * Reuse of an already-rotated token is treated as compromise and kills the
   * session; see `SessionService.resolve`.
   */
  async refresh(presentedToken: string): Promise<AuthSessionDto> {
    const session = await this.sessions.resolve(presentedToken);
    const user = await this.users.findActiveById(session.userId);

    if (!user) {
      await this.sessions.revoke(session.id);
      throw AppException.unauthorized('Account is no longer active');
    }

    // The absolute deadline is carried forward rather than recomputed from the
    // clock. Recomputing would shorten an extended ("remember me") session to the
    // standard window on its first refresh, and extending on every refresh would
    // let one stolen token live forever.
    const expiresAt = session.expiresAt;
    const issued = await this.issueTokenPairUntil({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
      refreshExpiresAt: expiresAt,
    });

    await this.sessions.rotate(session, issued.refreshToken, expiresAt);

    return { user: this.users.toAuthDto(user), tokens: issued.tokens };
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (!sessionId) return;
    await this.sessions.revoke(sessionId);
  }

  /** Records activity so the sessions list reflects genuine usage. */
  async touchSession(sessionId: string | undefined): Promise<void> {
    if (!sessionId) return;
    const session = await this.sessions.findById(sessionId);
    if (session?.isActiveAt(this.clock.now())) {
      await this.sessions.touch(session);
    }
  }

  listSessions(userId: string, currentSessionId: string): Promise<SessionSummary[]> {
    return this.sessions.listForUser(userId, currentSessionId);
  }

  /** Revokes one device. The current session may be revoked, which signs out. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    // 404 rather than 403 when the row belongs to somebody else, so the
    // endpoint cannot be used to probe which session ids exist.
    if (!session || session.userId !== userId) {
      throw AppException.notFound('Session');
    }
    await this.sessions.revoke(sessionId);
  }

  /**
   * Replaces the password and invalidates every session.
   *
   * Including the caller's own: whoever performed the change may be the
   * attacker, so leaving the current device signed in would defeat the purpose.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<{ revokedSessions: number }> {
    const user = await this.users.findByIdWithPassword(userId);

    const matches = await this.passwords.verify(input.currentPassword, user?.passwordHash ?? null);
    if (!user || !matches) {
      throw AppException.unauthorized('Current password is incorrect');
    }

    this.passwords.assertAcceptable(input.newPassword);

    await this.users.savePasswordHash(user.id, await this.passwords.hash(input.newPassword));
    return { revokedSessions: await this.sessions.revokeAllForUser(user.id) };
  }

  /**
   * Password-reset request.
   *
   * Always resolves successfully: reporting whether an address is registered
   * would turn this endpoint into an account-enumeration oracle. The lookup and
   * the mail send therefore happen in the same branch-free path, and the caller
   * learns nothing from the response or its timing.
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    const user = await this.users.findByEmail(email);

    // Paid on every request regardless of whether the address exists. Skip it
    // and the registered branch answers measurably faster, because there is no
    // hash to verify — which is precisely the signal an enumeration attack
    // measures. The two branches are still not identical (only one of them
    // writes a row and sends a message); this closes the cheap tell, not the
    // whole gap.
    await this.passwords.verify('', null);

    if (!user || !user.isActive) return false;

    await this.resets.issue({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      resetUrlBase: this.resetUrlBase,
      ipAddress: null,
    });
    return true;
  }

  /** Redeems a reset token and revokes every live session. */
  async resetPassword(input: { token: string; newPassword: string }): Promise<void> {
    await this.resets.consume({ rawToken: input.token, newPassword: input.newPassword });
  }

  /**
   * Resolves the principal for an already-authenticated request.
   *
   * Re-reads the user so a deactivated account loses access immediately rather
   * than at the end of the access token's lifetime.
   */
  async resolvePrincipal(userId: string): Promise<AuthSessionDto['user']> {
    const user = await this.users.findActiveById(userId);
    if (!user) {
      throw AppException.unauthorized('Account is no longer active');
    }
    return this.users.toAuthDto(user);
  }

  /** Fresh session identifier stamped into every token pair. */
  createSessionId(): string {
    return randomUUID();
  }

  async issueTokenPair(params: {
    userId: string;
    email: string;
    role: AuthUserDto['role'];
    sessionId: string;
    rememberMe: boolean;
  }): Promise<{ tokens: AuthTokensDto; refreshToken: string; refreshExpiresAt: Date }> {
    return this.issueTokenPairUntil({
      userId: params.userId,
      email: params.email,
      role: params.role,
      sessionId: params.sessionId,
      refreshExpiresAt: new Date(
        this.clock.nowMs() + this.tokens.refreshLifetimeFor(params.rememberMe) * 1000,
      ),
    });
  }

  /**
   * Issues a pair whose refresh token expires at an absolute instant.
   *
   * Rotation uses this so the deadline stays exactly where the original sign-in
   * put it, instead of drifting forward with each refresh.
   */
  private async issueTokenPairUntil(params: {
    userId: string;
    email: string;
    role: AuthUserDto['role'];
    sessionId: string;
    refreshExpiresAt: Date;
  }): Promise<{ tokens: AuthTokensDto; refreshToken: string; refreshExpiresAt: Date }> {
    const access = await this.tokens.signAccessToken({
      userId: params.userId,
      email: params.email,
      role: params.role,
      sessionId: params.sessionId,
    });

    const refreshToken = this.tokens.generateRefreshToken();
    const refreshExpiresAt = params.refreshExpiresAt;

    return {
      refreshToken,
      refreshExpiresAt,
      tokens: {
        accessToken: access.token,
        refreshToken,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
        tokenType: 'Bearer',
      },
    };
  }

  /** Issues a pair and persists the session row backing the refresh token. */
  private async startSession(
    user: User,
    rememberMe: boolean,
    context: SessionContext,
  ): Promise<AuthSessionDto> {
    const issued = await this.issueTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: this.createSessionId(),
      rememberMe,
    });

    await this.sessions.open({
      userId: user.id,
      role: user.role,
      refreshToken: issued.refreshToken,
      expiresAt: issued.refreshExpiresAt,
      context,
    });

    return { user: this.users.toAuthDto(user), tokens: issued.tokens };
  }
}
