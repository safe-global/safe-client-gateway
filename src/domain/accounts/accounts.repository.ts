import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import {
  Account,
  AccountSchema,
} from '@/domain/accounts/entities/account.entity';
import { UpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AccountsRepository implements IAccountsRepository {
  constructor(
    @Inject(IAccountsDatasource)
    private readonly datasource: IAccountsDatasource,
  ) {}

  async createAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    clientIp: Request['ip'];
  }): Promise<Account> {
    if (!args.clientIp || !args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    const account = await this.datasource.createAccount({
      address: args.address,
      clientIp: args.clientIp,
    });
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
    return this.datasource.deleteAccount(args.address);
  }

  async getDataTypes(): Promise<AccountDataType[]> {
    return this.datasource.getDataTypes();
  }

  async getAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<AccountDataSetting[]> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }

    return this.datasource.getAccountDataSettings(args.address);
  }

  async upsertAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<AccountDataSetting[]> {
    const { address, upsertAccountDataSettingsDto } = args;
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    if (upsertAccountDataSettingsDto.accountDataSettings.length === 0) {
      return [];
    }

    return this.datasource.upsertAccountDataSettings({
      address,
      upsertAccountDataSettingsDto,
    });
  }
}
