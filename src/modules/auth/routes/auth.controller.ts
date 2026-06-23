// SPDX-License-Identifier: FSL-1.1-MIT

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthService } from '@/modules/auth/routes/auth.service';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthNonce } from '@/modules/auth/routes/entities/auth-nonce.entity';
import {
  LogoutDto,
  LogoutDtoSchema,
} from '@/modules/auth/routes/entities/logout.dto.entity';
import {
  SiweDto,
  SiweDtoSchema,
} from '@/modules/auth/routes/entities/siwe.dto.entity';
import { UserSession } from '@/modules/auth/routes/entities/user-session.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  type CookieOptions,
  getCookieOptions,
} from '@/modules/auth/utils/auth-cookie.utils';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

/**
 * The AuthController is responsible for handling SiWe authentication:
 *
 * 1. Calling `/v1/auth/nonce` returns a unique nonce to be signed.
 * 2. The client signs this nonce in a SiWe message, sending it and
 *    the signature to `/v1/auth/verify` for verification.
 * 3. If verification succeeds, JWT token is added to `access_token`
 *    Set-Cookie.
 *
 */
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly authService: AuthService,
  ) {
    this.isProduction = this.configurationService.getOrThrow<boolean>(
      'application.isProduction',
    );
  }

  @ApiOperation({
    summary: 'Get authenticated user',
    description:
      'Returns the authenticated user session if a valid session cookie is present, 403 otherwise. ' +
      'The response includes the user ID, the authentication method used, and (for SIWE users) the wallet signer address.',
  })
  @ApiOkResponse({
    description: 'Authenticated user session',
    type: UserSession,
  })
  @ApiForbiddenResponse({ description: 'Not authenticated' })
  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@Auth() authPayload: AuthPayload): Promise<UserSession> {
    return await this.authService.getUserSession(authPayload);
  }

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
  getNonce(): Promise<AuthNonce> {
    return this.authService.getNonce();
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
    res: FastifyReply,
    @Body(new ValidationPipe(SiweDtoSchema))
    siweDto: SiweDto,
  ): Promise<void> {
    const { accessToken } =
      await this.authService.authenticateWithSiwe(siweDto);

    res.setCookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
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
  logout(@Res({ passthrough: true }) res: FastifyReply): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, this.getCookieOptions());
  }

  @ApiOperation({
    summary: 'Logout (with redirect)',
    description:
      'Clears the authentication cookie and redirects the browser. ' +
      'For OIDC users, redirects through identity platform to clear their session cookie. ' +
      'For SiWe users, redirects directly to the app.',
  })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({ type: LogoutDto, required: false })
  @ApiResponse({
    status: 303,
    description:
      'Redirects to identity platform logout (OIDC) or directly to the app.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid redirect URL',
  })
  @HttpCode(303)
  @Post('logout/redirect')
  logoutWithRedirect(
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body(new ValidationPipe(LogoutDtoSchema))
    body: LogoutDto,
  ): void {
    const accessToken: string | undefined =
      req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, this.getCookieOptions());
    const location = this.authService.getLogoutRedirectUrl(
      accessToken,
      body.redirect_url,
    );
    res.redirect(location, 303);
  }

  private getCookieOptions(): CookieOptions {
    return getCookieOptions(this.isProduction);
  }

  /**
   * Extract the expiration time from the token and return the maximum age.
   * @param accessToken - JWT token
   * @returns maximum age of the token in seconds or undefined if none set
   *
   */
  private getMaxAge(accessToken: string): number | undefined {
    const { exp } = this.authService.getTokenPayloadWithClaims(accessToken);
    return exp ? getSecondsUntil(exp) : undefined;
  }
}
