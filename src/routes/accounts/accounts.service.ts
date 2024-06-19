import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { Account } from '@/domain/accounts/entities/account.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AccountsService {
  constructor(
    @Inject('AccountsRepository')
    private readonly accountsRepository: IAccountsRepository,
  ) {}

  async createAccount(args: { address: `0x${string}` }): Promise<Account> {
    // TODO: route entity
    return this.accountsRepository.createAccount(args);
  }
}
