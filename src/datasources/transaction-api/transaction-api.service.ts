import { Balance } from './entities/balance.entity';
import { Backbone } from '../../chains/entities';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';

export class TransactionApi {
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
    return await this.dataSource.get<Balance[]>(cacheKey, url, {
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
    return await this.dataSource.get<Backbone>(cacheKey, url);
  }
}
