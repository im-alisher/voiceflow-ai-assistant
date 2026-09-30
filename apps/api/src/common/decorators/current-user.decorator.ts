import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AppException } from '../errors';
import type { AuthenticatedPrincipal } from '../interfaces';

/**
 * Injects the principal resolved by the JWT strategy.
 *
 * Typed as `AuthenticatedPrincipal` rather than `any` so a handler cannot
 * assume a field the guard did not populate.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedPrincipal | undefined, _ctx: ExecutionContext) => {
    const request = _ctx.switchToHttp().getRequest<{ user?: AuthenticatedPrincipal }>();
    const user = request.user;
    if (!user) {
      throw AppException.unauthorized();
    }
    return field ? user[field] : user;
  },
);
