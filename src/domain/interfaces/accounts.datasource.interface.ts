import type { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import type { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import type { Account } from '@/domain/accounts/entities/account.entity';
import type { UpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';

export const IAccountsDatasource = Symbol('IAccountsDatasource');

export interface IAccountsDatasource {
  createAccount(args: {
    address: `0x${string}`;
    clientIp: string;
  }): Promise<Account>;

  getAccount(address: `0x${string}`): Promise<Account>;

  deleteAccount(address: `0x${string}`): Promise<void>;

  getDataTypes(): Promise<AccountDataType[]>;

  getAccountDataSettings(address: `0x${string}`): Promise<AccountDataSetting[]>;

  upsertAccountDataSettings(args: {
    address: `0x${string}`;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<AccountDataSetting[]>;
}
