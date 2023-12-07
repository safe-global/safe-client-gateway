import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { EmailService } from '@/routes/email/email.service';
import { EmailRegistrationGuard } from '@/routes/email/guards/email-registration.guard';
import { TimestampGuard } from '@/routes/email/guards/timestamp.guard';
import { OnlySafeOwnerGuard } from '@/routes/email/guards/only-safe-owner.guard';
import { SaveEmailDto } from '@/routes/email/entities/save-email-dto.entity';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { ResendVerificationDto } from '@/routes/email/entities/resend-verification-dto.entity';
import { EmailAlreadyVerifiedExceptionFilter } from '@/routes/email/exception-filters/email-already-verified.exception-filter';
import { ResendVerificationTimespanExceptionFilter } from '@/routes/email/exception-filters/resend-verification-timespan-error.exception-filter';

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
    EmailRegistrationGuard,
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
}
