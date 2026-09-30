import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthSessionDto, AuthUserDto } from '@voiceflow/shared';
import type { Request, Response } from 'express';
import { ApiResponseDto } from '../../common/dtos';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthenticatedPrincipal } from '../../common/interfaces';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/auth.dto';
import { AuthCookieService, readRefreshToken } from './services/auth-cookie.service';
import type { SessionSummary } from './services/session.service';

/**
 * Credential and session HTTP surface.
 *
 * The refresh token is delivered twice on success — as an `httpOnly` cookie for
 * browsers and in the body for non-browser clients. Browsers never need to read
 * it from JavaScript, so an XSS payload cannot exfiltrate it.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange credentials for a token pair' })
  @ApiOkResponse({ description: 'Authenticated session with tokens' })
  @ApiUnauthorizedResponse({ description: 'Incorrect email or password' })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponseDto<AuthSessionDto>> {
    const session = await this.auth.login({
      credentials: { email: body.email, password: body.password, rememberMe: body.rememberMe },
      context: sessionContextFrom(request),
    });

    this.attachRefreshCookie(response, session);
    return ApiResponseDto.ok(session);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an account and sign in' })
  @ApiCreatedResponse({ description: 'The newly created session' })
  @ApiConflictResponse({ description: 'An account already uses this email address' })
  async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponseDto<AuthSessionDto>> {
    const session = await this.auth.register({
      registration: {
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        acceptedTerms: body.acceptedTerms,
      },
      context: sessionContextFrom(request),
    });

    this.attachRefreshCookie(response, session);
    return ApiResponseDto.ok(session);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  @ApiOkResponse({ description: 'Rotated session with a fresh access token' })
  @ApiUnauthorizedResponse({ description: 'The refresh token is unknown, reused, or expired' })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponseDto<AuthSessionDto>> {
    const presented = readRefreshToken(
      request.cookies as Record<string, string | undefined>,
      body.refreshToken,
    );
    const session = await this.auth.refresh(presented);

    this.attachRefreshCookie(response, session);
    return ApiResponseDto.ok(session);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiOkResponse({ description: 'Session revoked and cookie cleared' })
  async logout(
    @CurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(sessionId);
    this.cookies.clearRefreshToken(response);
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the currently authenticated principal' })
  @ApiOkResponse({ description: 'The authenticated user' })
  async me(@CurrentUser('userId') userId: string): Promise<ApiResponseDto<AuthUserDto>> {
    return ApiResponseDto.ok(await this.auth.resolvePrincipal(userId));
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Replace the password and sign out every device' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() body: ChangePasswordDto,
  ): Promise<ApiResponseDto<{ revokedSessions: number }>> {
    return ApiResponseDto.ok(
      await this.auth.changePassword(userId, {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      }),
    );
  }

  /**
   * Always answers 200.
   *
   * The response is identical whether or not the address exists, so this route
   * cannot be used to discover which emails have accounts.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<ApiResponseDto<{ accepted: true }>> {
    await this.auth.requestPasswordReset(body.email);
    return ApiResponseDto.ok({ accepted: true });
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List the signed-in devices for this account' })
  @ApiOkResponse({ description: 'Active and expired sessions, most recently used first' })
  async listSessions(
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<ApiResponseDto<SessionSummary[]>> {
    return ApiResponseDto.ok(await this.auth.listSessions(user.userId, user.sessionId));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one session, including the current one' })
  @ApiOkResponse({ description: 'Session revoked' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) sessionId: string,
  ): Promise<void> {
    await this.auth.revokeSession(user.userId, sessionId);
  }

  private attachRefreshCookie(response: Response, session: AuthSessionDto): void {
    this.cookies.setRefreshToken(
      response,
      session.tokens.refreshToken,
      new Date(session.tokens.refreshTokenExpiresAt),
    );
  }
}

/** Captures what the sessions list shows the user about their own devices. */
function sessionContextFrom(request: Request): {
  userAgent: string | null;
  ipAddress: string | null;
} {
  return {
    userAgent: request.get('user-agent') ?? null,
    ipAddress: request.ip ?? null,
  };
}
