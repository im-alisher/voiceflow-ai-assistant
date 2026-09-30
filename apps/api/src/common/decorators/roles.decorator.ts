import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { UserRole } from '@voiceflow/shared';

export const ROLES_KEY = 'auth:roles';

/** Restricts a route to the listed roles. Read by `RolesGuard`. */
export const Roles = (...roles: readonly UserRole[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
