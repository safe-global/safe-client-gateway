import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EmailsService } from '@/routes/emails/emails.service';
import { RegisterEmailDto } from '@/routes/emails/entities/register-email.dto.entity';
import { RegisterEmailDtoValidationPipe } from '@/routes/emails/pipes/register-email.dto.validation.pipe';
import { EmailsGuard } from '@/routes/emails/emails.guard';

@ApiTags('emails')
@Controller({
  version: '1',
})
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @UseGuards(EmailsGuard)
  @ApiOkResponse()
  @HttpCode(200)
  @Post('chains/:chainId/safes/:safeAddress/emails')
  async registerEmailAddress(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(RegisterEmailDtoValidationPipe)
    registerEmailDto: RegisterEmailDto,
  ): Promise<string> {
    return this.emailsService.registerEmail({
      chainId,
      safeAddress,
      ...registerEmailDto,
    });
  }
}
