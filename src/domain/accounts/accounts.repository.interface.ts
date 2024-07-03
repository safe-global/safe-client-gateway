import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { AccountsRepository } from '@/domain/accounts/accounts.repository';
import { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
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

  upsertAccountDataSettings(args: {
    auth: AuthPayloadDto;
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
