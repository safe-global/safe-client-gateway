import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { EmailService } from '@/routes/email/email.service';
import {
  EmailGuard,
  EmailGuardActionPrefix,
} from '@/routes/email/guards/email.guard';
import { TimestampGuard } from '@/routes/email/guards/timestamp.guard';
import { OnlySafeOwnerGuard } from '@/routes/email/guards/only-safe-owner.guard';
import { SaveEmailDto } from '@/routes/email/entities/save-email-dto.entity';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { ResendVerificationDto } from '@/routes/email/entities/resend-verification-dto.entity';
import { EmailAlreadyVerifiedExceptionFilter } from '@/routes/email/exception-filters/email-already-verified.exception-filter';
import { ResendVerificationTimespanExceptionFilter } from '@/routes/email/exception-filters/resend-verification-timespan-error.exception-filter';
import { VerifyEmailDto } from '@/routes/email/entities/verify-email-dto.entity';
import { InvalidVerificationCodeExceptionFilter } from '@/routes/email/exception-filters/invalid-verification-code.exception-filter';
import { DeleteEmailDto } from '@/routes/email/entities/delete-email-dto.entity';

@ApiTags('email')
@Controller({
  path: 'chains/:chainId/safes/:safeAddress/emails',
  version: '1',
})
@ApiExcludeController()
export class EmailController {
  constructor(private readonly service: EmailService) {}

  @Post('')
  @UseGuards(
    EmailGuard(EmailGuardActionPrefix.Register),
    TimestampGuard(5 * 60 * 1000), // 5 minutes
    OnlySafeOwnerGuard,
  )
  async saveEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() saveEmailDto: SaveEmailDto,
  ): Promise<void> {
    await this.service.saveEmail({
      chainId,
      emailAddress: saveEmailDto.emailAddress,
      safeAddress,
      account: saveEmailDto.account,
    });
  }

  @Put('verify-resend')
  @UseFilters(
    EmailAlreadyVerifiedExceptionFilter,
    ResendVerificationTimespanExceptionFilter,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<void> {
    await this.service.resendVerification({
      chainId,
      safeAddress,
      account: resendVerificationDto.account,
    });
  }

  @Put('verify')
  @UseFilters(InvalidVerificationCodeExceptionFilter)
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmailAddress(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<void> {
    await this.service.verifyEmailAddress({
      chainId,
      safeAddress,
      account: verifyEmailDto.account,
      code: verifyEmailDto.code,
    });
  }

  @Delete('')
  @UseGuards(
    EmailGuard(EmailGuardActionPrefix.Delete),
    TimestampGuard(5 * 60 * 1000), // 5 minutes
    OnlySafeOwnerGuard,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() deleteEmailDto: DeleteEmailDto,
  ): Promise<void> {
    await this.service.deleteEmail({
      chainId,
      safeAddress,
      account: deleteEmailDto.account,
    });
  }
}
