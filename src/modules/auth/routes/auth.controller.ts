// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getMillisecondsUntil } from '@/domain/common/utils/time';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  getCookieOptions,
} from '@/modules/auth/utils/auth-cookie.utils';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
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
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { type CookieOptions, Response } from 'express';
import { UserSession } from '@/modules/auth/routes/entities/user-session.entity';

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
      'Returns the authenticated user ID if a valid session cookie is present, 403 otherwise.',
  })
  @ApiOkResponse({ description: 'Authenticated user ID', type: UserSession })
  @ApiForbiddenResponse({ description: 'Not authenticated' })
  @UseGuards(AuthGuard)
  @Get('me')
  getMe(@Auth() authPayload: AuthPayload): UserSession {
    return { id: authPayload.getUserId() };
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
  async getNonce(): Promise<AuthNonce> {
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
    return getCookieOptions(this.isProduction);
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
