import { Account } from '@/domain/accounts/entities/account.entity';
import { AccountsService } from '@/routes/accounts/accounts.service';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  // TODO: route entity, body DTO
  // @ApiOkResponse({ type: Account })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAccount(
    @Body() body: { address: `0x${string}` },
  ): Promise<Account> {
    return this.accountsService.createAccount(body);
  }
}
