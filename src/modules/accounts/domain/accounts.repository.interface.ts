import { AccountsDatasourceModule } from '@/modules/accounts/datasources/accounts.datasource.module';
import { AccountsRepository } from '@/modules/accounts/domain/accounts.repository';
import { AccountDataSetting } from '@/modules/accounts/domain/entities/account-data-setting.entity';
import { AccountDataType } from '@/modules/accounts/domain/entities/account-data-type.entity';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { CreateAccountDto } from '@/modules/accounts/domain/entities/create-account.dto.entity';
import { UpsertAccountDataSettingsDto } from '@/modules/accounts/domain/entities/upsert-account-data-settings.dto.entity';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Module } from '@nestjs/common';
import { Request } from 'express';
import type { Address } from 'viem';

export const IAccountsRepository = Symbol('IAccountsRepository');

export interface IAccountsRepository {
  createAccount(args: {
    authPayload: AuthPayload;
    createAccountDto: CreateAccountDto;
    clientIp: Request['ip'];
  }): Promise<Account>;

  getAccount(args: {
    authPayload: AuthPayload;
    address: Address;
  }): Promise<Account>;

  deleteAccount(args: {
    authPayload: AuthPayload;
    address: Address;
  }): Promise<void>;

  getDataTypes(): Promise<Array<AccountDataType>>;

  getAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: Address;
  }): Promise<Array<AccountDataSetting>>;

  upsertAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: Address;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<Array<AccountDataSetting>>;
}

@Module({
  imports: [AccountsDatasourceModule],
  providers: [
    {
      provide: IAccountsRepository,
      useClass: AccountsRepository,
    },
  ],
  exports: [IAccountsRepository],
})
export class AccountsRepositoryModule {}
