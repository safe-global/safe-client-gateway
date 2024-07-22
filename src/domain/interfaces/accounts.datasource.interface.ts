import { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { UpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';

export const IAccountsDatasource = Symbol('IAccountsDatasource');

export interface IAccountsDatasource {
  createAccount(address: `0x${string}`): Promise<Account>;

  getAccount(address: `0x${string}`): Promise<Account>;

  deleteAccount(address: `0x${string}`): Promise<void>;

  getDataTypes(): Promise<AccountDataType[]>;

  getAccountDataSettings(address: `0x${string}`): Promise<AccountDataSetting[]>;

  upsertAccountDataSettings(args: {
    address: `0x${string}`;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<AccountDataSetting[]>;
}
