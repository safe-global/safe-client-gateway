import { Balance } from './entities/balance.entity';
import { Backbone } from '../chains/entities';

export interface ITransactionApi {
  getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]>;

  getBackbone(): Promise<Backbone>;
}
