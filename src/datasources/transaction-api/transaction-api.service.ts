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
import { DataDecoded } from '../../domain/data-decoder/entities/data-decoded.entity';
import { Delegate } from '../../domain/delegate/entities/delegate.entity';
import { INetworkService } from '../network/network.service.interface';
import { Transfer } from '../../domain/safe/entities/transfer.entity';
import { MultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import { NetworkResponse } from '../network/entities/network.response.entity';

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
    private readonly networkService: INetworkService,
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

  async getDataDecoded(data: string, to: string): Promise<DataDecoded> {
    try {
      const url = `${this.baseUrl}/api/v1/data-decoder/`;
      const { data: dataDecoded } = await this.networkService.post(url, {
        data,
        to,
      });
      return dataDecoded;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
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

  async postDelegates(
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    signature?: string,
    label?: string,
  ): Promise<NetworkResponse<any>> {
    try {
      const url = `${this.baseUrl}/api/v1/delegates/`;
      return await this.networkService.post(url, {
        safe: safeAddress,
        delegate: delegate,
        delegator: delegator,
        signature: signature,
        label: label,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getTransfers(
    safeAddress: string,
    onlyErc20: boolean,
    onlyErc721: boolean,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transfer>> {
    try {
      const cacheKey = `${this.chainId}_${safeAddress}_transfers`;
      const cacheKeyField = `${onlyErc20}_${onlyErc721}_${limit}_${offset}`;
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/transfers/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          erc20: onlyErc20,
          erc721: onlyErc721,
          limit: limit,
          offset: offset,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMultisigTransactions(
    safeAddress: string,
    ordering?: string,
    executed?: boolean,
    trusted?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    try {
      const cacheKey = `${this.chainId}_${safeAddress}_multisig_transactions`;
      const cacheKeyField = `${safeAddress}_${ordering}_${executed}_${trusted}_${limit}_${offset}`;
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          safe: safeAddress,
          ordering: ordering,
          executed: executed,
          trusted: trusted,
          limit: limit,
          offset: offset,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
