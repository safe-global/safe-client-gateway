import { Account } from '@/datasources/accounts/entities/account.entity';

export const IAccountsDatasource = Symbol('IAccountsDatasource');

export interface IAccountsDatasource {
  createAccount(address: `0x${string}`): Promise<Account>;

  getAccount(address: `0x${string}`): Promise<Account>;
}
