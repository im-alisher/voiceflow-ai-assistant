import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@voiceflow/shared';
import { ROLES_KEY } from '../decorators';
import { AppException } from '../errors';
import type { AuthenticatedPrincipal } from '../interfaces';

/**
 * Route-scoped authorisation.
 *
 * Always registered *after* `JwtAuthGuard` so the principal is already
 * verified; a route with no `@Roles()` metadata is allowed for every role.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedPrincipal }>();
    if (!user) throw AppException.unauthorized();

    if (!required.includes(user.role)) {
      throw AppException.forbidden('Your role does not permit this action');
    }

    return true;
  }
}
