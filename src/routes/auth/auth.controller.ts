import { Body, Controller, Get, Post, Req, HttpCode } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AuthService } from '@/routes/auth/auth.service';
import { VerifyAuthMessageDtoSchema } from '@/routes/auth/entities/schemas/verify-auth-message.dto.schema';
import { VerifyAuthMessageDto } from '@/routes/auth/entities/verify-auth-message.dto';

/**
 * The AuthController is responsible for handling all authentication:
 *
 * 1. Calling `/v1/auth/nonce` will return a unique nonce to be signed.
 * 2. The client signs this nonce in a SiWe message, sending it and
 *    the signature to `/v1/auth/verify` for verification.
 * 3. If verification success, a JWT access token is returned.
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

  @HttpCode(202)
  @Post('verify')
  async verify(
    @Req() request: Request,
    @Body(new ValidationPipe(VerifyAuthMessageDtoSchema))
    verifyAuthMessageDto: VerifyAuthMessageDto,
  ): Promise<{
    accessToken: string;
    tokenType: string;
    expiresIn: number | null;
  }> {
    return await this.authService.verify({
      request,
      verifyAuthMessageDto,
    });
  }
}
