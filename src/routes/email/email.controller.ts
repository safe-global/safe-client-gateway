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
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from '@/routes/email/email.service';
import { EmailRegistrationGuard } from '@/routes/email/guards/email-registration.guard';
import { EmailDeletionGuard } from '@/routes/email/guards/email-deletion.guard';
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
import { EmailAddressDoesNotExistExceptionFilter } from '@/routes/email/exception-filters/email-does-not-exist.exception-filter';
import { UpdateEmailDto } from '@/routes/email/entities/update-email-dto.entity';
import { EmailUpdateGuard } from '@/routes/email/guards/email-update.guard';
import { EmailUpdateMatchesExceptionFilter } from '@/routes/email/exception-filters/email-update-matches.exception-filter';

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
    EmailDeletionGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
    OnlySafeOwnerGuard,
  )
  @UseFilters(EmailAddressDoesNotExistExceptionFilter)
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

  @Put('')
  @UseGuards(
    EmailUpdateGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
    OnlySafeOwnerGuard,
  )
  @UseFilters(
    EmailUpdateMatchesExceptionFilter,
    EmailAddressDoesNotExistExceptionFilter,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  async updateEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() updateEmailDto: UpdateEmailDto,
  ): Promise<void> {
    await this.service.updateEmail({
      chainId,
      safeAddress,
      account: updateEmailDto.account,
      emailAddress: updateEmailDto.emailAddress,
    });
  }

  @Cron(CronExpression.EVERY_WEEK)
  async deleteUnverifiedEmailsOlderThanAWeek(): Promise<void> {
    const today = new Date();
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1_000;
    const oneWeekAgo = new Date(today.getTime() - oneWeekInMs);

    await this.service.deleteUnverifiedEmailsUntil(oneWeekAgo);
  }
}
