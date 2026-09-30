import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, systemClock } from '../../common';
import { PASSWORD_HASHER } from '../../common/constants';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshSession } from './entities/refresh-session.entity';
import { AuthCookieService } from './services/auth-cookie.service';
import { BCRYPT_PASSWORD_HASHER, PasswordService } from './services/password.service';
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
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    TypeOrmModule.forFeature([RefreshSession]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    SessionService,
    AuthCookieService,
    JwtStrategy,
    { provide: CLOCK, useValue: systemClock },
    { provide: PASSWORD_HASHER, useValue: BCRYPT_PASSWORD_HASHER },
  ],
  exports: [AuthService, TokenService, PasswordService, SessionService, JwtModule, PassportModule],
})
export class AuthModule {}

export { RefreshSession } from './entities/refresh-session.entity';
export type { PasswordHasher } from './services/password-hasher.interface';
export type { SessionContext, SessionSummary } from './services/session.service';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
