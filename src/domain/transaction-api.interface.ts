import { Balance } from './entities/balance.entity';
import { Backbone } from '../chains/entities';

export const ITransactionApi = Symbol('ITransactionApi');

export interface ITransactionApi {
  getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]>;

  getBackbone(): Promise<Backbone>;
}
