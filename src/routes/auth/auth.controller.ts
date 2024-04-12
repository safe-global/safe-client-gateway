import { Body, Controller, Get, Post, HttpCode, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AuthService } from '@/routes/auth/auth.service';
import {
  VerifyAuthMessageDto,
  VerifyAuthMessageDtoSchema,
} from '@/routes/auth/entities/verify-auth-message.dto.entity';
import { Response } from 'express';
import { getMillisecondsUntil } from '@/domain/common/utils/time';

/**
 * The AuthController is responsible for handling authentication:
 *
 * 1. Calling `/v1/auth/nonce` returns a unique nonce to be signed.
 * 2. The client signs this nonce in a SIWE message, sending it and
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
    @Body(new ValidationPipe(VerifyAuthMessageDtoSchema))
    verifyAuthMessageDto: VerifyAuthMessageDto,
  ): Promise<void> {
    const { accessToken } =
      await this.authService.getAccessToken(verifyAuthMessageDto);

    const maxAge = verifyAuthMessageDto.message.expirationTime
      ? getMillisecondsUntil(
          new Date(verifyAuthMessageDto.message.expirationTime),
        )
      : undefined;

    res.cookie(AuthController.ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
  }
}
