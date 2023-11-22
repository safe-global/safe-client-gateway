import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { EmailService } from '@/routes/email/email.service';
import { EmailRegistrationGuard } from '@/routes/email/guards/email-registration.guard';
import { TimestampGuard } from '@/routes/email/guards/timestamp.guard';
import { OnlySafeOwnerGuard } from '@/routes/email/guards/only-safe-owner.guard';
import { SaveEmailDto } from '@/routes/email/entities/save-email-dto.entity';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';

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
}
