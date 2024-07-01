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
    const { auth, address } = args;
    this.checkAuth(auth, address);
    const account = await this.datasource.createAccount(address);
    return AccountSchema.parse(account);
  }

  async getAccount(args: {
    auth: AuthPayloadDto;
    address: `0x${string}`;
  }): Promise<Account> {
    const { auth, address } = args;
    this.checkAuth(auth, address);
    const account = await this.datasource.getAccount(address);
    return AccountSchema.parse(account);
  }

  async deleteAccount(args: {
    auth: AuthPayloadDto;
    address: `0x${string}`;
  }): Promise<void> {
    const { auth, address } = args;
    this.checkAuth(auth, address);
    // TODO: trigger a cascade deletion of the account-associated data.
    return this.datasource.deleteAccount(address);
  }

  private checkAuth(auth: AuthPayloadDto, address: `0x${string}`): void {
    const authPayload = new AuthPayload(auth);
    if (!authPayload.isForSigner(address)) {
      throw new UnauthorizedException();
    }
  }
}
