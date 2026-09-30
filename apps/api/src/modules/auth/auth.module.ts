import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, systemClock } from '../../common';
import { UsersModule } from '../users/users.module';
import { RefreshSession } from './entities/refresh-session.entity';
import { AuthService } from './auth.service';
import { BCRYPT_PASSWORD_HASHER, PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PASSWORD_HASHER } from '../../common/constants';

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
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    JwtStrategy,
    { provide: CLOCK, useValue: systemClock },
    { provide: PASSWORD_HASHER, useValue: BCRYPT_PASSWORD_HASHER },
  ],
  exports: [AuthService, TokenService, PasswordService, JwtModule, PassportModule],
})
export class AuthModule {}

export { RefreshSession } from './entities/refresh-session.entity';
export type { PasswordHasher } from './services/password-hasher.interface';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
