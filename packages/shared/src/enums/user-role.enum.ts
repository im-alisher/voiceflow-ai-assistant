/** Coarse authorisation tier. Reserved for administrative tooling. */
export const USER_ROLES = ['user', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];
