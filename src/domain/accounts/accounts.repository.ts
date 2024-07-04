import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import {
  Account,
  AccountSchema,
} from '@/domain/accounts/entities/account.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AccountsRepository implements IAccountsRepository {
  constructor(
    @Inject(IAccountsDatasource)
    private readonly datasource: IAccountsDatasource,
  ) {}

  async createAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Account> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    const account = await this.datasource.createAccount(args.address);
    return AccountSchema.parse(account);
  }

  async getAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Account> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    const account = await this.datasource.getAccount(args.address);
    return AccountSchema.parse(account);
  }

  async deleteAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    // TODO: trigger a cascade deletion of the account-associated data.
    return this.datasource.deleteAccount(args.address);
  }

  async getDataTypes(): Promise<AccountDataType[]> {
    // TODO: add caching with clearing mechanism.
    return this.datasource.getDataTypes();
  }
}
