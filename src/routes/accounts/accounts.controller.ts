import { AccountsService } from '@/routes/accounts/accounts.service';
import { Account } from '@/routes/accounts/entities/account.entity';
import { CreateAccountDto } from '@/routes/accounts/entities/create-account.dto.entity';
import { CreateAccountDtoSchema } from '@/routes/accounts/entities/schemas/create-account.dto.schema';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @ApiOkResponse({ type: Account })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  async createAccount(
    @Body(new ValidationPipe(CreateAccountDtoSchema))
    createAccountDto: CreateAccountDto,
    @Req() request: Request,
  ): Promise<Account> {
    const auth = request.accessToken;
    return this.accountsService.createAccount({ auth, createAccountDto });
  }

  @Delete(':address')
  @UseGuards(AuthGuard)
  async deleteAccount(
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Req() request: Request,
  ): Promise<void> {
    const auth = request.accessToken;
    return this.accountsService.deleteAccount({ auth, address });
  }
}
