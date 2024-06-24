import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { Account as DomainAccount } from '@/domain/accounts/entities/account.entity';
import { AuthPayloadDto } from '@/domain/auth/entities/auth-payload.entity';
import { Account } from '@/routes/accounts/entities/account.entity';
import { CreateAccountDto } from '@/routes/accounts/entities/create-account.dto.entity';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(IAccountsRepository)
    private readonly accountsRepository: IAccountsRepository,
  ) {}

  async createAccount(args: {
    auth: AuthPayloadDto | undefined;
    createAccountDto: CreateAccountDto;
  }): Promise<Account> {
    if (args.auth === undefined) {
      throw new UnauthorizedException();
    }
    const domainAccount = await this.accountsRepository.createAccount({
      auth: args.auth,
      address: args.createAccountDto.address,
    });
    return this.mapAccount(domainAccount);
  }

  private mapAccount(domainAccount: DomainAccount): Account {
    return new Account(
      domainAccount.id.toString(),
      domainAccount.group_id?.toString() ?? null,
      domainAccount.address,
    );
  }
}
