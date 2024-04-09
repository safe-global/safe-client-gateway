import { Body, Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AuthService } from '@/routes/auth/auth.service';
import {
  VerifyAuthMessageDto,
  VerifyAuthMessageDtoSchema,
} from '@/routes/auth/entities/verify-auth-message.dto.entity';

/**
 * The AuthController is responsible for handling authentication:
 *
 * 1. Calling `/v1/auth/nonce` returns a unique nonce to be signed.
 * 2. The client signs this nonce in a SIWE message, sending it and
 *    the signature to `/v1/auth/verify` for verification.
 * 3. If verification succeeds, a JWT access token is returned.
 * 4. The access token should be used in the `Authorization` header for
 *    all routes protected by the AuthGuard.
 */
@Controller({ path: 'auth', version: '1' })
@ApiExcludeController()
export class AuthController {
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
    @Body(new ValidationPipe(VerifyAuthMessageDtoSchema))
    verifyAuthMessageDto: VerifyAuthMessageDto,
  ): Promise<{
    accessToken: string;
    tokenType: string;
    expiresIn: number | null;
  }> {
    return await this.authService.verify(verifyAuthMessageDto);
  }
}
