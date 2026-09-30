import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.schema';

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately weaker than `passwordSchema`: an existing account may pre-date
  // the current policy, and login must never leak policy details.
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().default(false),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(64, 'Name must not exceed 64 characters'),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms to continue' }),
  }),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20),
    password: passwordSchema,
  })
  .refine((value) => !/^\s/.test(value.password) && !/\s$/.test(value.password), {
    message: 'Password must not start or end with whitespace',
    path: ['password'],
  });

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
