import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import {
  Account,
  AccountSchema,
} from '@/domain/accounts/entities/account.entity';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AccountsRepository implements IAccountsRepository {
  constructor(
    @Inject(IAccountsDatasource)
    private readonly datasource: IAccountsDatasource,
  ) {}

  async createAccount(args: { address: `0x${string}` }): Promise<Account> {
    const account = await this.datasource.createAccount(args.address);
    return AccountSchema.parse(account);
  }
}
