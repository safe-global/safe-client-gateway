import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { ITransactionApi } from '../../domain/interfaces/transaction-api.interface';
import { Balance } from '../../domain/balances/entities/balance.entity';
import { Backbone } from '../../domain/backbone/entities/backbone.entity';
import { Inject } from '@nestjs/common';
import { CacheService, ICacheService } from '../cache/cache.service.interface';

function balanceCacheKey(chainId: string, safeAddress: string): string {
  return `${chainId}_${safeAddress}_balances`;
}

export class TransactionApi implements ITransactionApi {
  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {}

  async getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    const cacheKey = balanceCacheKey(this.chainId, safeAddress);
    const cacheKeyField = `${trusted}_${excludeSpam}`;
    const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/balances/usd/`;
    return this.dataSource.get(cacheKey, cacheKeyField, url, {
      params: {
        trusted: trusted,
        exclude_spam: excludeSpam,
      },
    });
  }

  async clearLocalBalances(safeAddress: string): Promise<void> {
    const cacheKey = balanceCacheKey(this.chainId, safeAddress);
    await this.cacheService.delete(cacheKey);
  }

  async getBackbone(): Promise<Backbone> {
    const cacheKey = `${this.chainId}_backbone`;
    const field = '';
    const url = `${this.baseUrl}/api/v1/about`;
    return this.dataSource.get(cacheKey, field, url);
  }
}
