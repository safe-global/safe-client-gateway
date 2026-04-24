// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  getCookieOptions,
} from '@/modules/auth/utils/auth-cookie.utils';
import { OidcAuthRateLimitGuard } from '@/modules/auth/oidc/routes/guards/oidc-auth-rate-limit.guard';
import { OidcAuthService } from '@/modules/auth/oidc/routes/oidc-auth.service';
import {
  OidcConnectionSchema,
  type OidcConnection,
} from '@/modules/auth/oidc/routes/entities/oidc-connection.entity';
import { RedirectUrlSchema } from '@/validation/entities/schemas/redirect-url.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiFoundResponse,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { type CookieOptions, Request, Response } from 'express';

/**
 * The OidcAuthController handles OIDC (Auth0) authentication:
 *
 * 1. Calling `/v1/auth/oidc/authorize` redirects the browser to the
 *    OIDC provider login page with a generated state value stored in
 *    an HTTP-only cookie.
 * 2. The provider redirects back to `/v1/auth/oidc/callback` with an
 *    authorization code, which is exchanged for user information.
 * 3. If verification succeeds, a JWT token is added to the
 *    `access_token` Set-Cookie.
 * 4. Finally, the user is redirected to the post-login URL.
 *
 * Note: OIDC authentication is gated by the `FF_OIDC_AUTH` feature flag.
 */
@ApiTags('auth')
@UseGuards(OidcAuthRateLimitGuard)
@Controller({ path: 'auth', version: '1' })
export class OidcAuthController {
  static readonly OIDC_STATE_COOKIE_NAME = 'auth_state';
  private readonly isProduction: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly oidcAuthService: OidcAuthService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.isProduction = this.configurationService.getOrThrow<boolean>(
      'application.isProduction',
    );
  }

  @ApiOperation({
    summary: 'Start OIDC authorization code flow',
    description:
      'Redirects the browser to OIDC provider login page with a generated state value stored in an HTTP-only cookie.',
  })
  @ApiQuery({
    name: 'redirect_url',
    required: false,
    type: String,
    description:
      'URL to redirect to after successful login. Must be same-origin as the configured post-login redirect URI.',
    example: '/settings',
  })
  @ApiQuery({
    name: 'connection',
    required: false,
    type: String,
    description:
      'OIDC connection name to route to a specific identity provider.',
  })
  @ApiFoundResponse({
    description: 'Redirect to OIDC authorize endpoint',
  })
  @Get('oidc/authorize')
  authorize(
    @Res({ passthrough: true })
    res: Response,
    @Query('redirect_url', new ValidationPipe(RedirectUrlSchema))
    redirectUrl?: string,
    @Query('connection', new ValidationPipe(OidcConnectionSchema.optional()))
    connection?: OidcConnection,
  ): void {
    this.loggingService.debug(
      `Auth authorize: starting OIDC authorize redirect with redirectUrl=${redirectUrl ?? 'default'} and connection=${connection ?? 'default'}`,
    );
    const { authorizationUrl, state, stateMaxAge } =
      this.oidcAuthService.createOidcAuthorizationRequest(
        redirectUrl,
        connection,
      );

    res.cookie(OidcAuthController.OIDC_STATE_COOKIE_NAME, state, {
      ...this.getCookieOptions(),
      maxAge: stateMaxAge,
    });
    res.redirect(authorizationUrl);
  }

  @ApiOperation({
    summary: 'Handle OIDC authorization callback',
    description:
      'Exchanges the OIDC authorization code for user information, mints the internal JWT cookie, and redirects to the provided post-login URL or a configured default one.',
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
      'Redirect to the post-login URL. On error, includes error query parameter.',
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
    this.loggingService.debug(
      `Auth callback: received callback with code=${code ? 'present' : 'absent'}, state=${state ? 'present' : 'absent'}, error=${error ?? 'none'}`,
    );
    const expectedState: string | undefined =
      req.cookies?.[OidcAuthController.OIDC_STATE_COOKIE_NAME];
    // Always clear the one-time state cookie
    res.clearCookie(
      OidcAuthController.OIDC_STATE_COOKIE_NAME,
      this.getCookieOptions(),
    );

    if (error) {
      this.loggingService.warn(
        `Auth callback: provider error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`,
      );
      res.redirect(this.buildErrorRedirectUrl(error, expectedState));
      return;
    }

    if (!code || !state) {
      this.loggingService.warn('Auth callback: missing code or state');
      res.redirect(
        this.buildErrorRedirectUrl('invalid_request', expectedState),
      );
      return;
    }

    if (!expectedState || expectedState !== state) {
      this.loggingService.warn('Auth callback: state mismatch');
      res.redirect(this.buildErrorRedirectUrl('invalid_request'));
      return;
    }

    this.loggingService.debug('Auth callback: state validated successfully');

    try {
      const { accessToken, maxAge } =
        await this.oidcAuthService.authenticateWithOidc(code);
      this.loggingService.debug(
        `Auth callback: OIDC authentication succeeded, setting access token cookie with maxAge=${maxAge ?? 'undefined'}`,
      );
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
        ...this.getCookieOptions(),
        maxAge,
      });
      const redirectUrl = this.oidcAuthService.getPostLoginRedirectUri(state);
      this.loggingService.debug(
        `Auth callback: redirecting authenticated user to ${redirectUrl}`,
      );
      res.redirect(redirectUrl);
    } catch (err) {
      this.loggingService.error(
        `Auth callback: authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      res.redirect(this.buildErrorRedirectUrl('authentication_failed', state));
    }
  }

  private getCookieOptions(): CookieOptions {
    return getCookieOptions(this.isProduction);
  }

  /**
   * Builds a redirect URL with the given error message as a query parameter.
   * @param error error message to include in the redirect URL
   * @param state optional OIDC state value used to resolve the redirect URL
   * from the original authorization request. If omitted, falls back to the
   * configured default post-login redirect URI.
   * @returns fully qualified URL to redirect the user to
   */
  private buildErrorRedirectUrl(error: string, state?: string): string {
    const url = new URL(this.oidcAuthService.getPostLoginRedirectUri(state));
    url.searchParams.set('error', error);
    return url.toString();
  }
}
