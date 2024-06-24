import { Account } from '@/domain/accounts/entities/account.entity';

export const IAccountsDatasource = Symbol('IAccountsDatasource');

export interface IAccountsDatasource {
  createAccount(address: `0x${string}`): Promise<Account>;

  getAccount(address: `0x${string}`): Promise<Account>;

  deleteAccount(address: `0x${string}`): Promise<void>;
}
