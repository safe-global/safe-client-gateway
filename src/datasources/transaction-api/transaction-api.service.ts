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
import { SafeList } from '../../domain/safe/entities/safe-list.entity';
import { Contract } from '../../domain/contracts/entities/contract.entity';
import { DataDecoded } from '../../domain/data-decoder/entities/data-decoded.entity';
import { Delegate } from '../../domain/delegate/entities/delegate.entity';
import { INetworkService } from '../network/network.service.interface';
import { Transfer } from '../../domain/safe/entities/transfer.entity';
import { MultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import { Transaction } from '../../domain/safe/entities/transaction.entity';
import { Token } from '../../domain/tokens/entities/token.entity';
import { ModuleTransaction } from '../../domain/safe/entities/module-transaction.entity';

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

  async postDelegate(
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    signature?: string,
    label?: string,
  ): Promise<unknown> {
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

  async deleteDelegate(
    delegate: string,
    delegator: string,
    signature: string,
  ): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/delegates/${delegate}`;
      return await this.networkService.delete(url, {
        delegate: delegate,
        delegator: delegator,
        signature: signature,
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

  async getIncomingTransfers(
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    tokenAddress?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transfer>> {
    try {
      const cacheKey = `${this.chainId}_${safeAddress}_incoming_transfers`;
      const cacheKeyField = `${executionDateGte}_${executionDateLte}_${to}_${value}_${tokenAddress}_${limit}_${offset}`;
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/incoming-transfers/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          execution_date__gte: executionDateGte,
          execution_date__lte: executionDateLte,
          to,
          value,
          tokenAddress,
          limit,
          offset,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getModuleTransactions(
    safeAddress: string,
    to?: string,
    module?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<ModuleTransaction>> {
    try {
      const cacheKey = `${this.chainId}_${safeAddress}_module_transactions`;
      const cacheKeyField = `${to}_${module}_${limit}_${offset}`;
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/module-transactions/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          to,
          module,
          limit,
          offset,
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

  async getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<MultisigTransaction> {
    try {
      const cacheKey = `${this.chainId}_${safeTransactionHash}_multisig_transaction`;
      const url = `${this.baseUrl}/api/v1/multisig-transactions/${safeTransactionHash}/`;
      return await this.dataSource.get(cacheKey, '', url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getAllTransactions(
    safeAddress: string,
    ordering?: string,
    executed?: boolean,
    queued?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transaction>> {
    try {
      const cacheKey = `${this.chainId}_${safeAddress}_all_transactions`;
      const cacheKeyField = `${ordering}_${executed}_${queued}_${limit}_${offset}`;
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/all-transactions/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          safe: safeAddress,
          ordering: ordering,
          executed: executed,
          queued: queued,
          limit: limit,
          offset: offset,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getToken(address: string): Promise<Token> {
    try {
      const cacheKey = `${this.chainId}_${address}_token`;
      const url = `${this.baseUrl}/api/v1/tokens/${address}`;
      return await this.dataSource.get(cacheKey, '', url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getTokens(limit?: number, offset?: number): Promise<Page<Token>> {
    try {
      const cacheKey = `${this.chainId}_tokens`;
      const cacheKeyField = `${limit}_${offset}`;
      const url = `${this.baseUrl}/api/v1/tokens/`;
      return await this.dataSource.get(cacheKey, cacheKeyField, url, {
        params: {
          limit: limit,
          offset: offset,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getSafesByOwner(ownerAddress: string): Promise<SafeList> {
    try {
      const cacheKey = `${this.chainId}_${ownerAddress}_owner_safes`;
      const url = `${this.baseUrl}/api/v1/owners/${ownerAddress}/safes/`;
      return await this.dataSource.get(cacheKey, '', url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
