import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { Backbone } from '@/domain/backbone/entities/backbone.entity';
import type { Singleton } from '@/domain/chains/entities/singleton.entity';
import type { Contract } from '@/domain/contracts/entities/contract.entity';
import type { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import type { Delegate } from '@/domain/delegate/entities/delegate.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Estimation } from '@/domain/estimations/entities/estimation.entity';
import type { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import type { IndexingStatus } from '@/domain/indexing/entities/indexing-status.entity';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { Message } from '@/domain/messages/entities/message.entity';
import type { Device } from '@/domain/notifications/v1/entities/device.entity';
import type { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import type { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { SafeList } from '@/domain/safe/entities/safe-list.entity';
import type { Safe } from '@/domain/safe/entities/safe.entity';
import type { Transaction } from '@/domain/safe/entities/transaction.entity';
import { isMultisigTransaction } from '@/domain/safe/entities/transaction.entity';
import type { Transfer } from '@/domain/safe/entities/transfer.entity';
import type { Token } from '@/domain/tokens/entities/token.entity';
import type { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import type { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { get } from 'lodash';
import { getAddress } from 'viem';

export class TransactionApi implements ITransactionApi {
  private static readonly ERROR_ARRAY_PATH = 'nonFieldErrors';
  private static readonly HOLESKY_CHAIN_ID = '17000';

  private readonly defaultExpirationTimeInSeconds: number;
  private readonly indexingExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;
  private readonly tokenNotFoundExpirationTimeSeconds: number;
  private readonly contractNotFoundExpirationTimeSeconds: number;
  private readonly ownersExpirationTimeSeconds: number;

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
    private readonly cacheService: ICacheService,
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    private readonly networkService: INetworkService,
    private readonly loggingService: ILoggingService,
  ) {
    this.indexingExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.indexing',
      );

    // TODO: Remove temporary cache times for Holesky chain.
    if (chainId === TransactionApi.HOLESKY_CHAIN_ID) {
      const holeskyExpirationTime =
        this.configurationService.getOrThrow<number>(
          'expirationTimeInSeconds.holesky',
        );
      this.defaultExpirationTimeInSeconds = holeskyExpirationTime;
      this.defaultNotFoundExpirationTimeSeconds = holeskyExpirationTime;
      this.tokenNotFoundExpirationTimeSeconds = holeskyExpirationTime;
      this.contractNotFoundExpirationTimeSeconds = holeskyExpirationTime;
      this.ownersExpirationTimeSeconds = holeskyExpirationTime;
    } else {
      this.defaultExpirationTimeInSeconds =
        this.configurationService.getOrThrow<number>(
          'expirationTimeInSeconds.default',
        );
      this.defaultNotFoundExpirationTimeSeconds =
        this.configurationService.getOrThrow<number>(
          'expirationTimeInSeconds.notFound.default',
        );
      this.tokenNotFoundExpirationTimeSeconds =
        this.configurationService.getOrThrow<number>(
          'expirationTimeInSeconds.notFound.token',
        );
      this.contractNotFoundExpirationTimeSeconds =
        this.configurationService.getOrThrow<number>(
          'expirationTimeInSeconds.notFound.contract',
        );
      this.ownersExpirationTimeSeconds =
        this.configurationService.getOrThrow<number>('owners.ownersTtlSeconds');
    }
  }

  async getDataDecoded(args: {
    data: `0x${string}`;
    to?: `0x${string}`;
  }): Promise<DataDecoded> {
    try {
      const url = `${this.baseUrl}/api/v1/data-decoder/`;
      const { data: dataDecoded } = await this.networkService.post<DataDecoded>(
        {
          url,
          data: {
            data: args.data,
            to: args.to,
          },
        },
      );
      return dataDecoded;
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getBackbone(): Promise<Backbone> {
    try {
      const cacheDir = CacheRouter.getBackboneCacheDir(this.chainId);
      const url = `${this.baseUrl}/api/v1/about`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getSingletons(): Promise<Singleton[]> {
    try {
      const cacheDir = CacheRouter.getSingletonsCacheDir(this.chainId);
      const url = `${this.baseUrl}/api/v1/about/singletons/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getIndexingStatus(): Promise<IndexingStatus> {
    try {
      const cacheDir = CacheRouter.getIndexingCacheDir(this.chainId);
      const url = `${this.baseUrl}/api/v1/about/indexing/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.indexingExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getSafe(safeAddress: `0x${string}`): Promise<Safe> {
    try {
      const cacheDir = CacheRouter.getSafeCacheDir({
        chainId: this.chainId,
        safeAddress,
      });
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async clearSafe(safeAddress: `0x${string}`): Promise<void> {
    const key = CacheRouter.getSafeCacheKey({
      chainId: this.chainId,
      safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  // TODO: this replicates logic from the CacheFirstDataSource.get method to avoid
  // implementation of response remapping but we should refactor it to avoid duplication
  async isSafe(safeAddress: `0x${string}`): Promise<boolean> {
    const cacheDir = CacheRouter.getIsSafeCacheDir({
      chainId: this.chainId,
      safeAddress,
    });

    const cached = await this.cacheService.hGet(cacheDir).catch(() => null);

    if (cached != null) {
      this.loggingService.debug({
        type: 'cache_hit',
        ...cacheDir,
      });

      return cached === 'true';
    } else {
      this.loggingService.debug({
        type: 'cache_miss',
        ...cacheDir,
      });
    }

    const isSafe = await (async (): Promise<boolean> => {
      try {
        const url = `${this.baseUrl}/api/v1/safes/${safeAddress}`;
        const { data } = await this.networkService.get({
          url,
        });

        return !!data;
      } catch (error) {
        if (
          error instanceof NetworkResponseError &&
          // Transaction Service returns 404 when address is not of a Safe
          error.response.status === 404
        ) {
          return false;
        }
        throw this.httpErrorFactory.from(this.mapError(error));
      }
    })();

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(isSafe),
      // We can indefinitely cache this as an address cannot "un-Safe" itself
      isSafe ? MAX_TTL : this.defaultExpirationTimeInSeconds,
    );

    return isSafe;
  }

  async clearIsSafe(safeAddress: `0x${string}`): Promise<void> {
    const key = CacheRouter.getIsSafeCacheKey({
      chainId: this.chainId,
      safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getContract(contractAddress: `0x${string}`): Promise<Contract> {
    try {
      const cacheDir = CacheRouter.getContractCacheDir({
        chainId: this.chainId,
        contractAddress,
      });
      const url = `${this.baseUrl}/api/v1/contracts/${contractAddress}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.contractNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getDelegates(args: {
    safeAddress?: `0x${string}`;
    delegate?: `0x${string}`;
    delegator?: `0x${string}`;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>> {
    try {
      const cacheDir = CacheRouter.getDelegatesCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v1/delegates/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            safe: args.safeAddress,
            delegate: args.delegate,
            delegator: args.delegator,
            label: args.label,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getDelegatesV2(args: {
    safeAddress?: `0x${string}`;
    delegate?: `0x${string}`;
    delegator?: `0x${string}`;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>> {
    try {
      const cacheDir = CacheRouter.getDelegatesCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v2/delegates/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            safe: args.safeAddress,
            delegate: args.delegate,
            delegator: args.delegator,
            label: args.label,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async postDelegate(args: {
    safeAddress: `0x${string}` | null;
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
    label: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/delegates/`;
      await this.networkService.post({
        url,
        data: {
          safe: args.safeAddress,
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          label: args.label,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async postDelegateV2(args: {
    safeAddress: `0x${string}` | null;
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
    label: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v2/delegates/`;
      await this.networkService.post({
        url,
        data: {
          safe: args.safeAddress,
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          label: args.label,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async deleteDelegate(args: {
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/delegates/${args.delegate}`;
      return await this.networkService.delete({
        url,
        data: {
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async deleteSafeDelegate(args: {
    delegate: `0x${string}`;
    safeAddress: `0x${string}`;
    signature: string;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/delegates/${args.delegate}`;
      return await this.networkService.delete({
        url,
        data: {
          delegate: args.delegate,
          safe: args.safeAddress,
          signature: args.signature,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async deleteDelegateV2(args: {
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    safeAddress: `0x${string}` | null;
    signature: string;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v2/delegates/${args.delegate}`;
      return await this.networkService.delete({
        url,
        data: {
          safe: args.safeAddress,
          delegator: args.delegator,
          signature: args.signature,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getTransfer(transferId: string): Promise<Transfer> {
    try {
      const cacheDir = CacheRouter.getTransferCacheDir({
        chainId: this.chainId,
        transferId,
      });
      const url = `${this.baseUrl}/api/v1/transfer/${transferId}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getTransfers(args: {
    safeAddress: string;
    onlyErc20: boolean;
    onlyErc721: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    try {
      const cacheDir = CacheRouter.getTransfersCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/transfers/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            erc20: args.onlyErc20,
            erc721: args.onlyErc721,
            limit: args.limit,
            offset: args.offset,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async clearTransfers(safeAddress: string): Promise<void> {
    const key = CacheRouter.getTransfersCacheKey({
      chainId: this.chainId,
      safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async getIncomingTransfers(args: {
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    txHash?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    try {
      const cacheDir = CacheRouter.getIncomingTransfersCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/incoming-transfers/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            execution_date__gte: args.executionDateGte,
            execution_date__lte: args.executionDateLte,
            to: args.to,
            value: args.value,
            token_address: args.tokenAddress,
            limit: args.limit,
            offset: args.offset,
            transaction_hash: args.txHash,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async clearIncomingTransfers(safeAddress: string): Promise<void> {
    const key = CacheRouter.getIncomingTransfersCacheKey({
      chainId: this.chainId,
      safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async postConfirmation(args: {
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/multisig-transactions/${args.safeTxHash}/confirmations/`;
      return await this.networkService.post({
        url,
        data: {
          signature: args.addConfirmationDto.signedSafeTxHash,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getSafesByModule(moduleAddress: string): Promise<SafeList> {
    try {
      const url = `${this.baseUrl}/api/v1/modules/${moduleAddress}/safes/`;
      const { data } = await this.networkService.get<SafeList>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getModuleTransaction(
    moduleTransactionId: string,
  ): Promise<ModuleTransaction> {
    try {
      const cacheDir = CacheRouter.getModuleTransactionCacheDir({
        chainId: this.chainId,
        moduleTransactionId,
      });
      const url = `${this.baseUrl}/api/v1/module-transaction/${moduleTransactionId}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getModuleTransactions(args: {
    safeAddress: `0x${string}`;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>> {
    try {
      const cacheDir = CacheRouter.getModuleTransactionsCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/module-transactions/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            to: args.to,
            transaction_hash: args.txHash,
            module: args.module,
            limit: args.limit,
            offset: args.offset,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async clearModuleTransactions(safeAddress: `0x${string}`): Promise<void> {
    const key = CacheRouter.getModuleTransactionsCacheKey({
      chainId: this.chainId,
      safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async getMultisigTransactions(args: {
    // TODO: safeAddress and to should be `0x${string}`
    safeAddress: string;
    ordering?: string;
    executed?: boolean;
    trusted?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    try {
      const cacheDir = CacheRouter.getMultisigTransactionsCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/multisig-transactions/`;
      return await this.dataSource
        .get<Page<MultisigTransaction>>({
          cacheDir,
          url,
          notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
          networkRequest: {
            params: {
              safe: args.safeAddress,
              ordering: args.ordering,
              executed: args.executed,
              trusted: args.trusted,
              execution_date__gte: args.executionDateGte,
              execution_date__lte: args.executionDateLte,
              to: args.to,
              value: args.value,
              nonce: args.nonce,
              nonce__gte: args.nonceGte,
              limit: args.limit,
              offset: args.offset,
            },
          },
          expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        })
        .then(async (data): Promise<Page<MultisigTransaction>> => {
          const results = await Promise.all(
            data.results.map(async (tx) => {
              return tx.confirmationsRequired !== null
                ? tx
                : await this._setConfirmationsRequired(tx);
            }),
          );

          return {
            ...data,
            results,
          };
        });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async clearMultisigTransactions(safeAddress: string): Promise<void> {
    const key = CacheRouter.getMultisigTransactionsCacheKey({
      chainId: this.chainId,
      safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<MultisigTransaction> {
    try {
      const cacheDir = CacheRouter.getMultisigTransactionCacheDir({
        chainId: this.chainId,
        safeTransactionHash,
      });
      const url = `${this.baseUrl}/api/v1/multisig-transactions/${safeTransactionHash}/`;
      return await this.dataSource
        .get<MultisigTransaction>({
          cacheDir,
          url,
          notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
          expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        })
        .then(async (tx) =>
          tx.confirmationsRequired !== null
            ? tx
            : await this._setConfirmationsRequired(tx),
        );
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  /**
   * The Transaction Service sometimes returns null for confirmationsRequired
   * TODO: Remove this method once the Transaction Service is fixed
   * @see https://github.com/safe-global/safe-transaction-service/issues/2170
   * @param transaction - {@link MultisigTransaction} maybe missing confirmationsRequired
   * @returns - {@link MultisigTransaction} with confirmationsRequired set
   */
  private async _setConfirmationsRequired(
    transaction: MultisigTransaction & {
      confirmationsRequired:
        | MultisigTransaction['confirmationsRequired']
        | null;
    },
  ): Promise<MultisigTransaction> {
    if (transaction.confirmationsRequired !== null) {
      return transaction;
    }

    transaction.confirmationsRequired =
      transaction.isExecuted && transaction.confirmations !== null
        ? transaction.confirmations.length
        : await this.getSafe(getAddress(transaction.safe)).then((safe) => {
            return safe.threshold;
          });

    return transaction;
  }

  async deleteTransaction(args: {
    safeTxHash: string;
    signature: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/multisig-transactions/${args.safeTxHash}`;
      await this.networkService.delete({
        url,
        data: {
          signature: args.signature,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async clearMultisigTransaction(safeTransactionHash: string): Promise<void> {
    const key = CacheRouter.getMultisigTransactionCacheKey({
      chainId: this.chainId,
      safeTransactionHash,
    });
    await this.cacheService.deleteByKey(key);
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getCreationTransaction(
    safeAddress: `0x${string}`,
  ): Promise<CreationTransaction> {
    try {
      const cacheDir = CacheRouter.getCreationTransactionCacheDir({
        chainId: this.chainId,
        safeAddress,
      });
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/creation/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getAllTransactions(args: {
    safeAddress: `0x${string}`;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    try {
      const cacheDir = CacheRouter.getAllTransactionsCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/all-transactions/`;
      return await this.dataSource
        .get<Page<Transaction>>({
          cacheDir,
          url,
          notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
          networkRequest: {
            params: {
              safe: args.safeAddress,
              ordering: args.ordering,
              executed: args.executed,
              queued: args.queued,
              limit: args.limit,
              offset: args.offset,
            },
          },
          expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        })
        .then(async (data): Promise<Page<Transaction>> => {
          const results = await Promise.all(
            data.results.map(async (tx) => {
              if (!isMultisigTransaction(tx)) {
                return tx;
              }
              return tx.confirmationsRequired !== null
                ? tx
                : await this._setConfirmationsRequired(tx);
            }),
          );

          return {
            ...data,
            results,
          };
        });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async clearAllTransactions(safeAddress: `0x${string}`): Promise<void> {
    const key = CacheRouter.getAllTransactionsKey({
      chainId: this.chainId,
      safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getToken(address: string): Promise<Token> {
    try {
      const cacheDir = CacheRouter.getTokenCacheDir({
        chainId: this.chainId,
        address,
      });
      const url = `${this.baseUrl}/api/v1/tokens/${address}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.tokenNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getTokens(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Token>> {
    try {
      const cacheDir = CacheRouter.getTokensCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v1/tokens/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [ownersExpirationTimeSeconds]
  async getSafesByOwner(ownerAddress: `0x${string}`): Promise<SafeList> {
    try {
      const cacheDir = CacheRouter.getSafesByOwnerCacheDir({
        chainId: this.chainId,
        ownerAddress,
      });
      const url = `${this.baseUrl}/api/v1/owners/${ownerAddress}/safes/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.ownersExpirationTimeSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async postDeviceRegistration(args: {
    device: Device;
    safes: string[];
    signatures: string[];
  }): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/notifications/devices/`;
      await this.networkService.post({
        url,
        data: {
          uuid: args.device.uuid,
          cloudMessagingToken: args.device.cloudMessagingToken,
          buildNumber: args.device.buildNumber,
          bundle: args.device.bundle,
          deviceType: args.device.deviceType,
          version: args.device.version,
          timestamp: args.device.timestamp,
          safes: args.safes,
          signatures: args.signatures,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async deleteDeviceRegistration(uuid: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/notifications/devices/${uuid}`;
      await this.networkService.delete({ url });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async deleteSafeRegistration(args: {
    uuid: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/notifications/devices/${args.uuid}/safes/${args.safeAddress}`;
      await this.networkService.delete({ url });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getEstimation(args: {
    address: `0x${string}`;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.address}/multisig-transactions/estimations/`;
      const { data: estimation } = await this.networkService.post<Estimation>({
        url,
        data: {
          to: args.getEstimationDto.to,
          value: args.getEstimationDto.value,
          data: args.getEstimationDto.data,
          operation: args.getEstimationDto.operation,
        },
      });
      return estimation;
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getMessageByHash(messageHash: string): Promise<Message> {
    try {
      const url = `${this.baseUrl}/api/v1/messages/${messageHash}`;
      const cacheDir = CacheRouter.getMessageByHashCacheDir({
        chainId: this.chainId,
        messageHash,
      });
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async getMessagesBySafe(args: {
    safeAddress: `0x${string}`;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Message>> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/messages/`;
      const cacheDir = CacheRouter.getMessagesBySafeCacheDir({
        chainId: this.chainId,
        ...args,
      });
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async postMultisigTransaction(args: {
    address: string;
    data: ProposeTransactionDto;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.address}/multisig-transactions/`;
      return await this.networkService.post({
        url,
        data: {
          to: args.data.to,
          value: args.data.value,
          data: args.data.data,
          operation: args.data.operation,
          baseGas: args.data.baseGas,
          gasPrice: args.data.gasPrice,
          gasToken: args.data.gasToken,
          refundReceiver: args.data.refundReceiver,
          nonce: args.data.nonce,
          safeTxGas: args.data.safeTxGas,
          contractTransactionHash: args.data.safeTxHash,
          sender: args.data.sender,
          signature: args.data.signature,
          origin: args.data.origin,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async postMessage(args: {
    safeAddress: `0x${string}`;
    message: unknown;
    safeAppId: number | null;
    signature: string;
  }): Promise<Message> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/messages/`;
      const { data } = await this.networkService.post<Message>({
        url,
        data: {
          message: args.message,
          safeAppId: args.safeAppId,
          signature: args.signature,
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async postMessageSignature(args: {
    messageHash: string;
    signature: string;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/messages/${args.messageHash}/signatures/`;
      const { data } = await this.networkService.post({
        url,
        data: {
          signature: args.signature,
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(this.mapError(error));
    }
  }

  async clearMessagesBySafe(args: {
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const key = CacheRouter.getMessagesBySafeCacheKey({
      chainId: this.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearMessagesByHash(args: { messageHash: string }): Promise<void> {
    const key = CacheRouter.getMessageByHashCacheKey({
      chainId: this.chainId,
      messageHash: args.messageHash,
    });
    await this.cacheService.deleteByKey(key);
  }

  private mapError(error: unknown): unknown {
    if (error instanceof NetworkResponseError) {
      const errors = get(error.data, TransactionApi.ERROR_ARRAY_PATH);
      if (errors) {
        return new NetworkResponseError(error.url, error.response, {
          // We only return the first error message so as to be a string
          message: errors[0],
        });
      }
    }
    return error;
  }
}
