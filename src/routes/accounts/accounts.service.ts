import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { Account as DomainAccount } from '@/domain/accounts/entities/account.entity';
import { Account } from '@/routes/accounts/entities/account.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(IAccountsRepository)
    private readonly accountsRepository: IAccountsRepository,
  ) {}

  // TODO: auth
  async createAccount(args: { address: `0x${string}` }): Promise<Account> {
    const domainAccount = await this.accountsRepository.createAccount(args);
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
