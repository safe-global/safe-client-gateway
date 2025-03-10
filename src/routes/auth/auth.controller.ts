import { IConfigurationService } from '@/config/configuration.service.interface';
import { getMillisecondsUntil } from '@/domain/common/utils/time';
import { AuthService } from '@/routes/auth/auth.service';
import { AuthNonce } from '@/routes/auth/entities/auth-nonce.entity';
import { SiweDto, SiweDtoSchema } from '@/routes/auth/entities/siwe.dto.entity';
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
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CookieOptions, Response } from 'express';

/**
 * The AuthController is responsible for handling authentication:
 *
 * 1. Calling `/v1/auth/nonce` returns a unique nonce to be signed.
 * 2. The client signs this nonce in a SiWe message, sending it and
 *    the signature to `/v1/auth/verify` for verification.
 * 3. If verification succeeds, JWT token is added to `access_token`
 *    Set-Cookie.
 */
@ApiTags('auth')
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

  @ApiOkResponse({ type: AuthNonce })
  @Get('nonce')
  async getNonce(): Promise<AuthNonce> {
    return this.authService.getNonce();
  }

  @HttpCode(200)
  @Post('verify')
  @ApiOkResponse({
    description: 'Empty response body. JWT token is set as response cookie.',
  })
  async verify(
    @Res({ passthrough: true })
    res: Response,
    @Body(new ValidationPipe(SiweDtoSchema))
    siweDto: SiweDto,
  ): Promise<void> {
    const { accessToken } = await this.authService.getAccessToken(siweDto);

    res.cookie(AuthController.ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      ...this.getCookieOptions(),
      // Extract maxAge from token as it may slightly differ to SiWe message
      maxAge: this.getMaxAge(accessToken),
    });
  }

  @HttpCode(200)
  @Post('logout')
  @ApiOkResponse({
    description:
      'Empty response body. Cookie value is removed and set to expire.',
  })
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
