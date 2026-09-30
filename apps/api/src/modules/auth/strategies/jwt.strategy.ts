import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UserRole } from '@voiceflow/shared';
import { AppException, type AuthenticatedPrincipal } from '../../../common';
import { CONFIG_NAMESPACE, type AuthConfig } from '../../../config';

/**
 * Validates the access token and produces the request principal.
 *
 * The strategy performs *no* database lookup: the token is self-contained and
 * short-lived, so a request is authorised in constant time. Anything that must
 * reflect current state (is the account still active? was this session
 * revoked?) is the responsibility of the service layer, not the transport.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const auth = config.getOrThrow<AuthConfig>(CONFIG_NAMESPACE.AUTH);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth.accessSecret,
      issuer: auth.issuer,
      audience: auth.audience,
    });
  }

  validate(claims: { sub: string; email: string; role: UserRole; sid: string }): AuthenticatedPrincipal {
    if (!claims?.sub || !claims?.sid) {
      throw AppException.unauthorized('Malformed access token');
    }
    return {
      userId: claims.sub,
      email: claims.email,
      role: claims.role,
      sessionId: claims.sid,
    };
  }
}
