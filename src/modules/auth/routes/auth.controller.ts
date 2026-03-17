// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getMillisecondsUntil } from '@/domain/common/utils/time';
import { AuthService } from '@/modules/auth/routes/auth.service';
import { AuthNonce } from '@/modules/auth/routes/entities/auth-nonce.entity';
import { Auth0Dto } from '@/modules/auth/routes/entities/auth0.dto.entity';
import { SiweDto } from '@/modules/auth/routes/entities/siwe.dto.entity';
import {
  VerifyAuthRequest,
  VerifyAuthRequestSchema,
} from '@/modules/auth/routes/entities/verify-auth.request.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CookieOptions, Response } from 'express';

/**
 * The AuthController is responsible for handling authentication:
 *
 * SiWE (Sign-In with Ethereum):
 * 1. Calling `/v1/auth/nonce` returns a unique nonce to be signed.
 * 2. The client signs this nonce in a SiWe message, sending it and
 *    the signature to `/v1/auth/verify` for verification.
 * 3. If verification succeeds, JWT token is added to `access_token`
 *    Set-Cookie.
 *
 * OIDC (e.g. Auth0):
 * 1. The client authenticates with the OIDC provider and obtains an
 *    access token.
 * 2. The client sends the access token to `/v1/auth/verify` for
 *    verification.
 * 3. If verification succeeds, JWT token is added to `access_token`
 *    Set-Cookie.
 */
@ApiTags('auth')
@ApiExtraModels(SiweDto, Auth0Dto)
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  static readonly ACCESS_TOKEN_COOKIE_NAME = 'access_token';
  static readonly ACCESS_TOKEN_COOKIE_SAME_SITE_LAX = 'lax';
  static readonly ACCESS_TOKEN_COOKIE_SAME_SITE_NONE = 'none';
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
      'Verifies authentication via either a signed Sign-In with Ethereum (SiWE) message or an Auth0 access token. On successful verification, sets an HTTP-only JWT cookie for subsequent authenticated requests.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SiweDto) },
        { $ref: getSchemaPath(Auth0Dto) },
      ],
    },
    description:
      'Sign-In with Ethereum message and signature, or Auth0 access token for verification',
  })
  @ApiOkResponse({
    description:
      'Authentication successful. JWT token set as HTTP-only cookie named "access_token".',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid SiWE message format, signature verification failed, or invalid Auth0 access token',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication failed - invalid credentials provided',
  })
  @HttpCode(200)
  @Post('verify')
  async verify(
    @Res({ passthrough: true })
    res: Response,
    @Body(new ValidationPipe(VerifyAuthRequestSchema))
    verifyAuthRequest: VerifyAuthRequest,
  ): Promise<void> {
    const { accessToken } =
      'access_token' in verifyAuthRequest
        ? await this.authService.verifyOidc(verifyAuthRequest.access_token)
        : await this.authService.verifySiwe(verifyAuthRequest);

    res.cookie(AuthController.ACCESS_TOKEN_COOKIE_NAME, accessToken, {
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
    res.clearCookie(
      AuthController.ACCESS_TOKEN_COOKIE_NAME,
      this.getCookieOptions(),
    );
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
