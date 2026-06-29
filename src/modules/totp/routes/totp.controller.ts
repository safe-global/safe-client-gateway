// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { getCookieOptions } from '@/modules/auth/utils/auth-cookie.utils';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import {
  TotpVerifyDto,
  TotpVerifyDtoSchema,
} from '@/modules/totp/routes/entities/totp-verify.dto.entity';
import { TotpService, type TotpStatus } from '@/modules/totp/routes/totp.service';
import { TOTP_TOKEN_COOKIE_NAME } from '@/modules/totp/totp.constants';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('auth')
@Controller({ path: 'auth/totp', version: '1' })
export class TotpController {
  private readonly isProduction: boolean;

  constructor(
    @Inject(TotpService)
    private readonly service: TotpService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.isProduction = configurationService.getOrThrow<boolean>(
      'application.isProduction',
    );
  }

  @ApiOperation({ summary: 'Start TOTP registration for the current user' })
  @Post()
  @UseGuards(AuthGuard)
  public async register(
    @Auth() authPayload: AuthPayload,
  ): Promise<{ uri: string; secret: string }> {
    const userId = this.getUserId(authPayload);
    const label = await this.resolveLabel(authPayload, userId);
    return this.service.startRegistration(userId, label);
  }

  @ApiOperation({
    summary: 'Verify a TOTP code and elevate the session',
    description:
      'On success, sets a short-lived elevation cookie that authorizes ' +
      'sensitive actions for the configured window.',
  })
  @Post('verify')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  public async verify(
    @Auth() authPayload: AuthPayload,
    @Body(new ValidationPipe(TotpVerifyDtoSchema)) dto: TotpVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { token, maxAgeMs } = await this.service.verifyCode(
      this.getUserId(authPayload),
      dto.code,
    );
    res.cookie(TOTP_TOKEN_COOKIE_NAME, token, {
      ...getCookieOptions(this.isProduction),
      maxAge: maxAgeMs,
    });
  }

  @ApiOperation({ summary: 'Get the current user TOTP status' })
  @Get()
  @UseGuards(AuthGuard)
  public async status(
    @Auth() authPayload: AuthPayload,
  ): Promise<{ status: TotpStatus }> {
    return { status: await this.service.getStatus(this.getUserId(authPayload)) };
  }

  // The user id always comes from the authenticated session, never from a
  // request parameter, so a caller can only ever act on their own account.
  private getUserId(authPayload: AuthPayload): number {
    const userId = authPayload.getUserId();
    if (!authPayload.isAuthenticated() || userId === undefined) {
      throw new UnauthorizedException();
    }
    return Number(userId);
  }

  // The label is the account name shown in the authenticator app: the email
  // for Google/email users, the wallet address for SIWE.
  private async resolveLabel(
    authPayload: AuthPayload,
    userId: number,
  ): Promise<string> {
    if (authPayload.isSiwe()) {
      return authPayload.signer_address;
    }
    const email = await this.usersRepository.findEmailById(userId);
    return email ?? String(userId);
  }
}
