import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AppException } from '../../../common';
import { CONFIG_NAMESPACE, type AuthConfig } from '../../../config';

/**
 * Name of the `httpOnly` cookie carrying the refresh token.
 *
 * The refresh token is *also* returned in the response body so non-browser
 * clients (CLI, tests, native shells) can hold it in memory; browsers ignore the
 * body copy and rely on the cookie, which JavaScript cannot read.
 */
export const REFRESH_TOKEN_COOKIE = 'vf_refresh';

/**
 * Owns every `Set-Cookie` decision for authentication.
 *
 * Centralised because the flags are security-critical and easy to get subtly
 * wrong at a call site: `httpOnly` defeats token theft via XSS, `secure` keeps
 * the token off plaintext connections, and `sameSite: 'none'` is only legal
 * alongside `secure` — browsers reject the cookie otherwise.
 */
@Injectable()
export class AuthCookieService {
  private readonly options: AuthConfig['cookie'];

  constructor(config: ConfigService) {
    this.options = config.getOrThrow<AuthConfig>(CONFIG_NAMESPACE.AUTH).cookie;
  }

  setRefreshToken(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_TOKEN_COOKIE, token, this.buildOptions(expiresAt));
  }

  clearRefreshToken(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.buildOptions(new Date(0)));
  }

  private buildOptions(expiresAt: Date): CookieOptions {
    const { domain, secure, sameSite } = this.options;

    return {
      httpOnly: true,
      secure,
      sameSite: sameSite === 'none' && !secure ? 'lax' : sameSite,
      path: '/',
      ...(domain ? { domain } : {}),
      expires: expiresAt,
    };
  }
}

/**
 * Resolves the refresh token from the cookie, falling back to the body.
 *
 * The cookie is preferred so the common browser flow needs no JavaScript access
 * to the credential at all.
 */
export function readRefreshToken(
  cookies: Record<string, string | undefined> | undefined,
  bodyToken: string | undefined,
): string {
  const token = cookies?.[REFRESH_TOKEN_COOKIE] ?? bodyToken;

  if (!token) {
    throw AppException.unauthorized('A refresh token is required');
  }
  return token;
}
