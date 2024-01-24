import { Balance } from '@/domain/balances/entities/balance.entity';

export interface IBalancesApi {
  getBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<Balance[]>;

  clearBalances(args: { safeAddress: string }): Promise<void>;
}
