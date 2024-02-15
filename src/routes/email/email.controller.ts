import {
  Body,
  Controller,
  Delete,
  Get,
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
import { EmailDeletionGuard } from '@/routes/email/guards/email-deletion.guard';
import { TimestampGuard } from '@/routes/email/guards/timestamp.guard';
import { OnlySafeOwnerGuard } from '@/routes/email/guards/only-safe-owner.guard';
import { SaveEmailDto } from '@/routes/email/entities/save-email-dto.entity';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { EmailAlreadyVerifiedExceptionFilter } from '@/routes/email/exception-filters/email-already-verified.exception-filter';
import { ResendVerificationTimespanExceptionFilter } from '@/routes/email/exception-filters/resend-verification-timespan-error.exception-filter';
import { VerifyEmailDto } from '@/routes/email/entities/verify-email-dto.entity';
import { InvalidVerificationCodeExceptionFilter } from '@/routes/email/exception-filters/invalid-verification-code.exception-filter';
import { AccountDoesNotExistExceptionFilter } from '@/routes/email/exception-filters/account-does-not-exist.exception-filter';
import { EditEmailDto } from '@/routes/email/entities/edit-email-dto.entity';
import { EmailEditGuard } from '@/routes/email/guards/email-edit.guard';
import { EmailEditMatchesExceptionFilter } from '@/routes/email/exception-filters/email-edit-matches.exception-filter';
import { EmailRetrievalGuard } from '@/routes/email/guards/email-retrieval.guard';
import { Email } from '@/routes/email/entities/email.entity';

@ApiTags('email')
@Controller({
  path: 'chains/:chainId/safes/:safeAddress/emails',
  version: '1',
})
@ApiExcludeController()
export class EmailController {
  constructor(private readonly service: EmailService) {}

  @Get(':signer')
  @UseGuards(
    EmailRetrievalGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
  )
  @UseFilters(AccountDoesNotExistExceptionFilter)
  async getEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Param('signer') signer: string,
  ): Promise<Email> {
    return this.service.getEmail({
      chainId,
      safeAddress,
      signer,
    });
  }

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
      signer: saveEmailDto.signer,
    });
  }

  @Post(':signer/verify-resend')
  @UseFilters(
    EmailAlreadyVerifiedExceptionFilter,
    ResendVerificationTimespanExceptionFilter,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Param('signer') signer: string,
  ): Promise<void> {
    await this.service.resendVerification({
      chainId,
      safeAddress,
      signer,
    });
  }

  @Put(':signer/verify')
  @UseFilters(InvalidVerificationCodeExceptionFilter)
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmailAddress(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Param('signer') signer: string,
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<void> {
    await this.service.verifyEmailAddress({
      chainId,
      safeAddress,
      signer,
      code: verifyEmailDto.code,
    });
  }

  @Delete(':signer')
  @UseGuards(
    EmailDeletionGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
  )
  @UseFilters(AccountDoesNotExistExceptionFilter)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Param('signer') signer: string,
  ): Promise<void> {
    await this.service.deleteEmail({
      chainId,
      safeAddress,
      signer,
    });
  }

  @Put(':signer')
  @UseGuards(
    EmailEditGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
  )
  @UseFilters(
    EmailEditMatchesExceptionFilter,
    AccountDoesNotExistExceptionFilter,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  async editEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Param('signer') signer: string,
    @Body() editEmailDto: EditEmailDto,
  ): Promise<void> {
    await this.service.editEmail({
      chainId,
      safeAddress,
      signer,
      emailAddress: editEmailDto.emailAddress,
    });
  }
}
