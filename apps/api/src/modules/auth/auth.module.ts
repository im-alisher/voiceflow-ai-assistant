import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, systemClock } from '../../common';
import { PASSWORD_HASHER } from '../../common/constants';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { AuthCookieService } from './services/auth-cookie.service';
import { BCRYPT_PASSWORD_HASHER, PasswordService } from './services/password.service';
import { PasswordResetService } from './services/password-reset.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Authentication bounded context.
 *
 * Owns credential verification, token issuance and session lifecycle. HTTP
 * concerns (cookies, status codes, throttling) stay in the controller so the
 * service remains reusable from a future CLI or WebSocket gateway.
 */
@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    TypeOrmModule.forFeature([RefreshSession, PasswordResetToken]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    SessionService,
    PasswordResetService,
    AuthCookieService,
    JwtStrategy,
    { provide: CLOCK, useValue: systemClock },
    { provide: PASSWORD_HASHER, useValue: BCRYPT_PASSWORD_HASHER },
  ],
  exports: [AuthService, TokenService, PasswordService, SessionService, JwtModule, PassportModule],
})
export class AuthModule {}

export { RefreshSession } from './entities/refresh-session.entity';
export { PasswordResetToken } from './entities/password-reset-token.entity';
export type { PasswordHasher } from './services/password-hasher.interface';
export type { SessionContext, SessionSummary } from './services/session.service';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
