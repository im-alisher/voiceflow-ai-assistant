import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators';
import { AppException } from '../../../common/errors';

/**
 * Deny-by-default authentication guard.
 *
 * Registered globally in `AppModule`, so authentication cannot be forgotten on
 * a newly added controller: only routes explicitly marked `@Public()` are
 * reachable without a token.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;
    return super.canActivate(context);
  }

  /** Converts Passport's generic 401 into the canonical error contract. */
  override handleRequest<TUser>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      const reason = info instanceof Error ? info.name : undefined;
      if (reason === 'TokenExpiredError') {
        throw new AppException('TOKEN_EXPIRED', 'Access token has expired');
      }
      throw AppException.unauthorized('A valid access token is required');
    }
    return user;
  }
}
