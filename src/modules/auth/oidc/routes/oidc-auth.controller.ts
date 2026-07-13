// SPDX-License-Identifier: FSL-1.1-MIT

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
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import {
  type OidcConnection,
  OidcConnectionSchema,
} from '@/modules/auth/oidc/routes/entities/oidc-connection.entity';
import { OidcAuthRateLimitGuard } from '@/modules/auth/oidc/routes/guards/oidc-auth-rate-limit.guard';
import {
  type Authenticator,
  OidcAuthService,
} from '@/modules/auth/oidc/routes/oidc-auth.service';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  getClearCookieOptions,
  getSetCookieOptions,
} from '@/modules/auth/utils/auth-cookie.utils';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';
import { RedirectUrlSchema } from '@/validation/entities/schemas/redirect-url.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

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
  @ApiQuery({
    name: 'enroll',
    required: false,
    type: Boolean,
    description:
      'When true, requests hosted enrollment of a new authenticator: the provider challenges an existing factor, then walks the user through enrolling the new one.',
  })
  @ApiFoundResponse({
    description: 'Redirect to OIDC authorize endpoint',
  })
  @Get('oidc/authorize')
  authorize(
    @Res({ passthrough: true })
    res: FastifyReply,
    @Query('redirect_url', new ValidationPipe(RedirectUrlSchema))
    redirectUrl?: string,
    @Query('connection', new ValidationPipe(OidcConnectionSchema.optional()))
    connection?: OidcConnection,
    @Query('enroll', new ValidationPipe(z.literal('true').optional()))
    enroll?: 'true',
  ): void {
    const { authorizationUrl, state, stateMaxAge } =
      this.oidcAuthService.createOidcAuthorizationRequest(
        redirectUrl,
        connection,
        enroll === 'true',
      );

    res.setCookie(
      OidcAuthController.OIDC_STATE_COOKIE_NAME,
      state,
      // `stateMaxAge` is in milliseconds; cookies expect seconds. Floor to at
      // least 1s so a sub-second TTL never collapses to `Max-Age=0`, which a
      // browser drops immediately and would break the callback state check.
      getSetCookieOptions(
        this.isProduction,
        Math.max(1, Math.floor(stateMaxAge / 1_000)),
      ),
    );
    res.redirect(authorizationUrl, 302);
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
    @Req() req: HttpRequest,
    @Res({ passthrough: true })
    res: FastifyReply,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ): Promise<void> {
    const expectedState: string | undefined =
      req.cookies?.[OidcAuthController.OIDC_STATE_COOKIE_NAME];
    // Always clear the one-time state cookie
    res.setCookie(
      OidcAuthController.OIDC_STATE_COOKIE_NAME,
      '',
      getClearCookieOptions(this.isProduction),
    );

    if (error) {
      this.loggingService.warn(
        `Auth callback: provider error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`,
      );
      res.redirect(
        this.buildErrorRedirectUrl(error, expectedState, errorDescription),
        302,
      );
      return;
    }

    if (!(code && state)) {
      this.loggingService.warn('Auth callback: missing code or state');
      res.redirect(
        this.buildErrorRedirectUrl('invalid_request', expectedState),
        302,
      );
      return;
    }

    if (!expectedState || expectedState !== state) {
      this.loggingService.warn('Auth callback: state mismatch');
      res.redirect(this.buildErrorRedirectUrl('invalid_request'), 302);
      return;
    }

    try {
      const { accessToken, maxAge, userId } =
        await this.oidcAuthService.authenticateWithOidc(code);

      if (this.oidcAuthService.isEnrollmentState(state)) {
        try {
          await this.oidcAuthService.cleanupSupersededAuthenticators(userId);
        } catch (cleanupError) {
          this.loggingService.warn(
            `Auth callback: superseded authenticator cleanup failed: ${asError(cleanupError).message}`,
          );
        }
      }

      res.setCookie(
        ACCESS_TOKEN_COOKIE_NAME,
        accessToken,
        getSetCookieOptions(this.isProduction, maxAge),
      );
      res.redirect(this.oidcAuthService.getPostLoginRedirectUri(state), 302);
    } catch (err) {
      const error = asError(err);
      this.loggingService.warn(
        `Auth callback: authentication failed: ${error.message}`,
      );
      res.redirect(
        this.buildErrorRedirectUrl('authentication_failed', state),
        302,
      );
    }
  }

  @ApiOperation({
    summary: 'List MFA authenticators',
    description:
      'Lists the MFA authentication methods of the authenticated user for the self-service authenticator ' +
      'management UI.',
  })
  @ApiOkResponse({ description: 'MFA authentication methods' })
  @ApiForbiddenResponse({ description: 'Not authenticated' })
  @UseGuards(AuthGuard)
  @Get('oidc/mfa/authenticators')
  async listAuthenticators(
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<Authenticator>> {
    return await this.oidcAuthService.listAuthenticators(authPayload);
  }

  /**
   * Builds a redirect URL with the given error message as a query parameter.
   * @param error error message to include in the redirect URL
   * @param state optional OIDC state value used to resolve the redirect URL
   * from the original authorization request. If omitted, falls back to the
   * configured default post-login redirect URI.
   * @param errorDescription optional description of the error
   * @returns fully qualified URL to redirect the user to
   */
  private buildErrorRedirectUrl(
    error: string,
    state?: string,
    errorDescription?: string,
  ): string {
    const url = new URL(this.oidcAuthService.getPostLoginRedirectUri(state));
    url.searchParams.set('error', error);
    if (errorDescription) {
      url.searchParams.set('error_description', errorDescription);
    }
    return url.toString();
  }
}
