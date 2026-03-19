// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getMillisecondsUntil } from '@/domain/common/utils/time';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { ACCESS_TOKEN_COOKIE_NAME } from '@/modules/auth/routes/auth.constants';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { AuthService } from '@/modules/auth/routes/auth.service';
import { AuthNonce } from '@/modules/auth/routes/entities/auth-nonce.entity';
import {
  SiweDto,
  SiweDtoSchema,
} from '@/modules/auth/routes/entities/siwe.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiNoContentResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';

/**
 * The AuthController is responsible for handling authentication:
 *
 * 1. Calling `/v1/auth/nonce` returns a unique nonce to be signed.
 * 2. The client signs this nonce in a SiWe message, sending it and
 *    the signature to `/v1/auth/verify` for verification.
 * 3. For Auth0, `/v1/auth/oidc/authorize` starts the authorization code flow
 *    and `/v1/auth/oidc/callback` exchanges the code for the gateway JWT.
 * 4. If verification succeeds, JWT token is added to `access_token`
 *    Set-Cookie.
 */
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  static readonly OIDC_STATE_COOKIE_NAME = 'auth_state';
  static readonly ACCESS_TOKEN_COOKIE_SAME_SITE_LAX = 'lax';
  static readonly ACCESS_TOKEN_COOKIE_SAME_SITE_NONE = 'none';
  private readonly isProduction: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly authService: AuthService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.isProduction = this.configurationService.getOrThrow<boolean>(
      'application.isProduction',
    );
  }

  @ApiOperation({
    summary: 'Check authentication status',
    description:
      'Returns 204 if a valid session cookie is present, 403 otherwise.',
  })
  @ApiNoContentResponse({ description: 'Authenticated' })
  @ApiForbiddenResponse({ description: 'Not authenticated' })
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Get('me')
  getMe(): void {}

  @ApiOperation({
    summary: 'Get authentication nonce',
    description:
      'Generates and returns a unique nonce that must be signed by the client for authentication. The nonce is used in the Sign-In with Ethereum (SiWE) message.',
  })
  @ApiOkResponse({
    type: AuthNonce,
    description: 'Unique nonce generated for authentication',
  })
  @Get('nonce')
  async getNonce(): Promise<AuthNonce> {
    return this.authService.getNonce();
  }

  @ApiOperation({
    summary: 'Start OIDC authorization code flow',
    description:
      'Redirects the browser to OIDC provider login page with a generated state value stored in an HTTP-only cookie.',
  })
  @ApiFoundResponse({
    description: 'Redirect to OIDC authorize endpoint',
  })
  @Get('oidc/authorize')
  authorize(
    @Res({ passthrough: true })
    res: Response,
  ): void {
    const { authorizationUrl, state, stateMaxAge } =
      this.authService.createOidcAuthorizationRequest();

    res.cookie(AuthController.OIDC_STATE_COOKIE_NAME, state, {
      ...this.getCookieOptions(),
      maxAge: stateMaxAge,
    });
    res.redirect(authorizationUrl);
  }

  @ApiOperation({
    summary: 'Handle OIDC authorization callback',
    description:
      'Exchanges the OIDC authorization code for user information, mints the internal JWT cookie, and redirects to the configured post-login URL.',
  })
  @ApiQuery({
    name: 'code',
    required: false,
    type: String,
    description: 'Authorization code returned by the OIDC provider',
    example: 'SplxlOBeZQQYbYS6WxSbIA',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'State parameter returned by the OIDC provider',
    example: 'af0ifjsldkj',
  })
  @ApiQuery({
    name: 'error',
    required: false,
    type: String,
    description: 'Error parameter returned by the OIDC provider',
    example: 'access_denied',
  })
  @ApiQuery({
    name: 'error_description',
    required: false,
    type: String,
    description:
      'Description of the error returned by the OIDC provider (if failed)',
    example: 'The user has denied the request',
  })
  @ApiFoundResponse({
    description:
      'Redirect to the configured post-login URL. On error, includes error query parameter.',
  })
  @Get('oidc/callback')
  async callback(
    @Req() req: Request,
    @Res({ passthrough: true })
    res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ): Promise<void> {
    const expectedState = req.cookies?.[AuthController.OIDC_STATE_COOKIE_NAME];
    // Always clear the one-time state cookie
    res.clearCookie(
      AuthController.OIDC_STATE_COOKIE_NAME,
      this.getCookieOptions(),
    );

    if (error) {
      this.loggingService.warn(
        `Auth callback: provider error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`,
      );
      res.redirect(this.buildErrorRedirectUrl(error));
      return;
    }

    if (!code || !state) {
      this.loggingService.warn('Auth callback: missing code or state');
      res.redirect(this.buildErrorRedirectUrl('invalid_request'));
      return;
    }

    if (!expectedState || expectedState !== state) {
      this.loggingService.warn('Auth callback: state mismatch');
      res.redirect(this.buildErrorRedirectUrl('invalid_request'));
      return;
    }

    try {
      const { accessToken } = await this.authService.authenticateWithOidc(code);
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
        ...this.getCookieOptions(),
        maxAge: this.getMaxAge(accessToken),
      });
      res.redirect(this.authService.getPostLoginRedirectUri());
    } catch (err) {
      this.loggingService.error(
        `Auth callback: authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      res.redirect(this.buildErrorRedirectUrl('authentication_failed'));
    }
  }

  @ApiOperation({
    summary: 'Verify authentication',
    description:
      'Verifies a signed Sign-In with Ethereum (SiWE) message and nonce. On successful verification, sets an HTTP-only JWT cookie for subsequent authenticated requests.',
  })
  @ApiBody({
    type: SiweDto,
    description: 'Sign-In with Ethereum message and signature for verification',
  })
  @ApiOkResponse({
    description:
      'Authentication successful. JWT token set as HTTP-only cookie named "access_token".',
  })
  @ApiBadRequestResponse({
    description: 'Invalid SiWE message format or signature verification failed',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication failed - invalid or expired nonce',
  })
  @HttpCode(200)
  @Post('verify')
  async verify(
    @Res({ passthrough: true })
    res: Response,
    @Body(new ValidationPipe(SiweDtoSchema))
    siweDto: SiweDto,
  ): Promise<void> {
    const { accessToken } =
      await this.authService.authenticateWithSiwe(siweDto);

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      ...this.getCookieOptions(),
      // Extract maxAge from token as it may slightly differ to SiWe message
      maxAge: this.getMaxAge(accessToken),
    });
  }

  @ApiOperation({
    summary: 'Logout user',
    description:
      'Logs out the authenticated user by clearing the JWT authentication cookie. This invalidates the current session.',
  })
  @ApiOkResponse({
    description:
      'Logout successful. Authentication cookie cleared and set to expire.',
  })
  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, this.getCookieOptions());
  }

  private getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: true,
      sameSite: this.isProduction
        ? AuthController.ACCESS_TOKEN_COOKIE_SAME_SITE_LAX
        : AuthController.ACCESS_TOKEN_COOKIE_SAME_SITE_NONE,
      path: '/',
    };
  }

  /**
   * Builds a redirect URL with the given error message as a query parameter.
   * This is used to redirect the user back to the client application with an error message
   * in case of authentication failure during the OIDC callback.
   * @param error error message to include in the redirect URL
   * @returns fully qualified URL to redirect the user to
   */
  private buildErrorRedirectUrl(error: string): string {
    const url = new URL(this.authService.getPostLoginRedirectUri());
    url.searchParams.set('error', error);
    return url.toString();
  }

  /**
   * Extract the expiration time from the token and return the maximum age.
   * @param accessToken - JWT token
   * @returns maximum age of the token in milliseconds or undefined if none set
   *
   * Note: the `Max-Age` of a cookie is in seconds, but express' requires it in
   * milliseconds when setting it with `res.cookie()`.
   * @see http://expressjs.com/en/api.html
   */
  private getMaxAge(accessToken: string): number | undefined {
    const { exp } = this.authService.getTokenPayloadWithClaims(accessToken);
    return exp ? getMillisecondsUntil(exp) : undefined;
  }
}
