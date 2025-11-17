import type { AccountDataSetting } from '@/modules/accounts/domain/entities/account-data-setting.entity';
import type { AccountDataType } from '@/modules/accounts/domain/entities/account-data-type.entity';
import type { Account } from '@/modules/accounts/domain/entities/account.entity';
import type { CreateAccountDto } from '@/modules/accounts/domain/entities/create-account.dto.entity';
import type { UpsertAccountDataSettingsDto } from '@/modules/accounts/domain/entities/upsert-account-data-settings.dto.entity';
import type { Address } from 'viem';

export const IAccountsDatasource = Symbol('IAccountsDatasource');

export interface IAccountsDatasource {
  createAccount(args: {
    createAccountDto: CreateAccountDto;
    clientIp: string;
  }): Promise<Account>;

  getAccount(address: Address): Promise<Account>;

  deleteAccount(address: Address): Promise<void>;

  getDataTypes(): Promise<Array<AccountDataType>>;

  getAccountDataSettings(address: Address): Promise<Array<AccountDataSetting>>;

  upsertAccountDataSettings(args: {
    address: Address;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<Array<AccountDataSetting>>;
}
