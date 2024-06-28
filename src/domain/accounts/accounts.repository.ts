import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import {
  Account,
  AccountSchema,
} from '@/domain/accounts/entities/account.entity';
import {
  AuthPayload,
  AuthPayloadDto,
} from '@/domain/auth/entities/auth-payload.entity';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AccountsRepository implements IAccountsRepository {
  constructor(
    @Inject(IAccountsDatasource)
    private readonly datasource: IAccountsDatasource,
  ) {}

  async createAccount(args: {
    auth: AuthPayloadDto;
    address: `0x${string}`;
  }): Promise<Account> {
    const authPayload = new AuthPayload(args.auth);
    if (!authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }

    const account = await this.datasource.createAccount(args.address);
    return AccountSchema.parse(account);
  }

  async deleteAccount(args: {
    auth: AuthPayloadDto;
    address: `0x${string}`;
  }): Promise<void> {
    const authPayload = new AuthPayload(args.auth);
    if (!authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    // TODO: trigger a cascade deletion of the account-associated data.
    return this.datasource.deleteAccount(args.address);
  }
}
