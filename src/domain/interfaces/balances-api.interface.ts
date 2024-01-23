import { Balance } from '@/domain/balances/entities/balance.entity';

export interface IBalancesApi {
  getBalances(args: {
    chainName: string;
    safeAddress: string;
  }): Promise<Balance[]>;

  clearBalances(args: { safeAddress: string }): Promise<void>;
}
