import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { ITransactionApi } from '../../domain/interfaces/transaction-api.interface';
import { Balance } from '../../domain/balances/entities/balance.entity';
import { Backbone } from '../../domain/backbone/entities/backbone.entity';

export class TransactionApi implements ITransactionApi {
  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
  ) {}

  async getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    // TODO key is not final
    const cacheKey = `balances-${this.chainId}-${safeAddress}-${trusted}-${excludeSpam}`;
    const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/balances/usd/`;
    return this.dataSource.get(cacheKey, url, {
      params: {
        trusted: trusted,
        excludeSpam: excludeSpam,
      },
    });
  }

  async getBackbone(): Promise<Backbone> {
    // TODO key is not final
    const cacheKey = `backbone-${this.chainId}`;
    const url = `${this.baseUrl}/api/v1/about`;
    return this.dataSource.get(cacheKey, url);
  }
}
