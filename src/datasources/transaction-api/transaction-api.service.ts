import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { ITransactionApi } from '../../domain/interfaces/transaction-api.interface';
import { Balance } from '../../domain/balances/entities/balance.entity';
import { Backbone } from '../../domain/backbone/entities/backbone.entity';
import { ICacheService } from '../cache/cache.service.interface';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { Collectible } from '../../domain/collectibles/entities/collectible.entity';
import { Page } from '../../domain/entities/page.entity';
import { MasterCopy } from '../../domain/chains/entities/master-copies.entity';
import { Safe } from '../../domain/safe/entities/safe.entity';
import { Contract } from '../../domain/contracts/entities/contract.entity';
import { Delegate } from '../../domain/safe/entities/delegate.entity';

function balanceCacheKey(chainId: string, safeAddress: string): string {
  return `${chainId}_${safeAddress}_balances`;
}

function safeCacheKey(chainId: string, safeAddress: string): string {
  return `${chainId}_${safeAddress}_safe`;
}

function contractCacheKey(chainId: string, contractAddress: string): string {
  return `${chainId}_${contractAddress}_contract`;
}

export class TransactionApi implements ITransactionApi {
  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
    private readonly cacheService: ICacheService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  async getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    try {
      const cacheKey = balanceCacheKey(this.chainId, safeAddress);
      const cacheKeyField = `${trusted}_${excludeSpam}`;
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/balances/usd/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          trusted: trusted,
          exclude_spam: excludeSpam,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearLocalBalances(safeAddress: string): Promise<void> {
    const cacheKey = balanceCacheKey(this.chainId, safeAddress);
    await this.cacheService.delete(cacheKey);
  }

  async getCollectibles(
    safeAddress: string,
    limit?: number,
    offset?: number,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Page<Collectible>> {
    try {
      const cacheKey = `${this.chainId}_${safeAddress}_collectibles`;
      const cacheKeyField = `${limit}_${offset}_${trusted}_${excludeSpam}`;
      const url = `${this.baseUrl}/api/v2/safes/${safeAddress}/collectibles/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          limit: limit,
          offset: offset,
          trusted: trusted,
          exclude_spam: excludeSpam,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getBackbone(): Promise<Backbone> {
    try {
      const cacheKey = `${this.chainId}_backbone`;
      const field = '';
      const url = `${this.baseUrl}/api/v1/about`;
      return await this.dataSource.get(cacheKey, field, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMasterCopies(): Promise<MasterCopy[]> {
    try {
      const cacheKey = `${this.chainId}_master-copies`;
      const field = '';
      const url = `${this.baseUrl}/api/v1/about/master-copies/`;
      return await this.dataSource.get(cacheKey, field, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getSafe(safeAddress: string): Promise<Safe> {
    try {
      const cacheKey = safeCacheKey(this.chainId, safeAddress);
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}`;
      return await this.dataSource.get(cacheKey, '', url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getContract(contractAddress: string): Promise<Contract> {
    try {
      const cacheKey = contractCacheKey(this.chainId, contractAddress);
      const url = `${this.baseUrl}/api/v1/contracts/${contractAddress}`;
      return await this.dataSource.get(cacheKey, '', url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getDelegates(
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    label?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Delegate>> {
    try {
      const cacheKey = `${this.chainId}_delegates`;
      const cacheKeyField = `${safeAddress}_${delegate}_${delegator}_${label}_${limit}_${offset}`;
      const url = `${this.baseUrl}/api/v1/delegates/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          safe: safeAddress,
          delegate: delegate,
          delegator: delegator,
          label: label,
          limit: limit,
          offset: offset,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
