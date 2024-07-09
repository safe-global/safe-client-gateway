import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { AccountsRepository } from '@/domain/accounts/accounts.repository';
import { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { UpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Module } from '@nestjs/common';

export const IAccountsRepository = Symbol('IAccountsRepository');

export interface IAccountsRepository {
  createAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Account>;

  getAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Account>;

  deleteAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void>;

  getDataTypes(): Promise<AccountDataType[]>;

  getAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<AccountDataSetting[]>;

  upsertAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    upsertAccountDataSettings: UpsertAccountDataSettingsDto;
  }): Promise<AccountDataSetting[]>;
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
