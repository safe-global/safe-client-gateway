import { Body, Controller, Get, Post, HttpCode, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AuthService } from '@/routes/auth/auth.service';
import { SiweDtoSchema, SiweDto } from '@/routes/auth/entities/siwe.dto.entity';
import { Response } from 'express';
import { getMillisecondsUntil } from '@/domain/common/utils/time';

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

  constructor(private readonly authService: AuthService) {}

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
      sameSite: 'lax',
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
