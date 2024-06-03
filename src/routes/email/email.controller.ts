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
import {
  SaveEmailDto,
  SaveEmailDtoSchema,
} from '@/routes/email/entities/save-email-dto.entity';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { VerifyEmailDto } from '@/routes/email/entities/verify-email-dto.entity';
import { AccountDoesNotExistExceptionFilter } from '@/routes/email/exception-filters/account-does-not-exist.exception-filter';
import { EditEmailDto } from '@/routes/email/entities/edit-email-dto.entity';
import { EmailEditMatchesExceptionFilter } from '@/routes/email/exception-filters/email-edit-matches.exception-filter';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Email } from '@/routes/email/entities/email.entity';
import { UnauthenticatedExceptionFilter } from '@/routes/email/exception-filters/unauthenticated.exception-filter';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('email')
@Controller({
  path: 'chains/:chainId/safes/:safeAddress/emails',
  version: '1',
})
@ApiExcludeController()
export class EmailController {
  constructor(private readonly service: EmailService) {}

  @Get(':signer')
  @UseGuards(AuthGuard)
  @UseFilters(AccountDoesNotExistExceptionFilter)
  async getEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('signer', new ValidationPipe(AddressSchema)) signer: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<Email> {
    return this.service.getEmail({
      chainId,
      safeAddress,
      signer,
      authPayload,
    });
  }

  @Post('')
  @UseGuards(AuthGuard)
  async saveEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Body(new ValidationPipe(SaveEmailDtoSchema)) saveEmailDto: SaveEmailDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    await this.service.saveEmail({
      chainId,
      emailAddress: saveEmailDto.emailAddress,
      safeAddress,
      signer: saveEmailDto.signer,
      authPayload,
    });
  }

  @Post(':signer/verify-resend')
  @UseFilters(new UnauthenticatedExceptionFilter(HttpStatus.ACCEPTED))
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('signer', new ValidationPipe(AddressSchema)) signer: `0x${string}`,
  ): Promise<void> {
    await this.service.resendVerification({
      chainId,
      safeAddress,
      signer,
    });
  }

  @Put(':signer/verify')
  @UseFilters(new UnauthenticatedExceptionFilter(HttpStatus.BAD_REQUEST))
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmailAddress(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('signer', new ValidationPipe(AddressSchema)) signer: `0x${string}`,
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
  @UseGuards(AuthGuard)
  @UseFilters(AccountDoesNotExistExceptionFilter)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('signer', new ValidationPipe(AddressSchema)) signer: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    await this.service.deleteEmail({
      chainId,
      safeAddress,
      signer,
      authPayload,
    });
  }

  @Put(':signer')
  @UseGuards(AuthGuard)
  @UseFilters(
    EmailEditMatchesExceptionFilter,
    AccountDoesNotExistExceptionFilter,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  async editEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('signer', new ValidationPipe(AddressSchema)) signer: `0x${string}`,
    @Body() editEmailDto: EditEmailDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    await this.service.editEmail({
      chainId,
      safeAddress,
      signer,
      emailAddress: editEmailDto.emailAddress,
      authPayload,
    });
  }
}
