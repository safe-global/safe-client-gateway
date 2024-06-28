import { IConfigurationService } from '@/config/configuration.service.interface';
import { getMillisecondsUntil } from '@/domain/common/utils/time';
import { AuthService } from '@/routes/auth/auth.service';
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
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

/**
 * The AuthController is responsible for handling authentication:
 *
 * 1. Calling `/v1/auth/nonce` returns a unique nonce to be signed.
 * 2. The client signs this nonce in a SiWe message, sending it and
 *    the signature to `/v1/auth/verify` for verification.
 * 3. If verification succeeds, JWT token is added to `access_token`
 *    Set-Cookie.
 */
@Controller({ path: 'auth', version: '1' })
@ApiExcludeController()
export class AuthController {
  static readonly ACCESS_TOKEN_COOKIE_NAME = 'access_token';
  private readonly cgwEnv: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly authService: AuthService,
  ) {
    this.cgwEnv =
      this.configurationService.getOrThrow<string>('application.env');
  }

  @Get('nonce')
  async getNonce(): Promise<{
    nonce: string;
  }> {
    return this.authService.getNonce();
  }

  @HttpCode(200)
  @Post('verify')
  async verify(
    @Res({ passthrough: true })
    res: Response,
    @Body(new ValidationPipe(SiweDtoSchema))
    siweDto: SiweDto,
  ): Promise<void> {
    const { accessToken } = await this.authService.getAccessToken(siweDto);

    res.cookie(AuthController.ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: this.cgwEnv === 'production' ? 'lax' : 'none',
      path: '/',
      // Extract maxAge from token as it may slightly differ to SiWe message
      maxAge: this.getMaxAge(accessToken),
    });
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
    return exp ? getMillisecondsUntil(new Date(exp * 1_000)) : undefined;
  }
}
