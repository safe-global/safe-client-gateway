import { Backbone } from '../backbone/entities/backbone.entity';
import { Balance } from '../balances/entities/balance.entity';

export interface ITransactionApi {
  getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]>;

  clearLocalBalances(safeAddress: string): Promise<void>;

  getBackbone(): Promise<Backbone>;
}
