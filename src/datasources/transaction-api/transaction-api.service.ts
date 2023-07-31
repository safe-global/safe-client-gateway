import { Backbone } from '../../domain/backbone/entities/backbone.entity';
import { Balance } from '../../domain/balances/entities/balance.entity';
import { MasterCopy } from '../../domain/chains/entities/master-copies.entity';
import { Collectible } from '../../domain/collectibles/entities/collectible.entity';
import { Contract } from '../../domain/contracts/entities/contract.entity';
import { DataDecoded } from '../../domain/data-decoder/entities/data-decoded.entity';
import { Delegate } from '../../domain/delegate/entities/delegate.entity';
import { Page } from '../../domain/entities/page.entity';
import { Estimation } from '../../domain/estimations/entities/estimation.entity';
import { GetEstimationDto } from '../../domain/estimations/entities/get-estimation.dto.entity';
import { ITransactionApi } from '../../domain/interfaces/transaction-api.interface';
import { Message } from '../../domain/messages/entities/message.entity';
import { Device } from '../../domain/notifications/entities/device.entity';
import { CreationTransaction } from '../../domain/safe/entities/creation-transaction.entity';
import { ModuleTransaction } from '../../domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import { SafeList } from '../../domain/safe/entities/safe-list.entity';
import { Safe } from '../../domain/safe/entities/safe.entity';
import { Transaction } from '../../domain/safe/entities/transaction.entity';
import { Transfer } from '../../domain/safe/entities/transfer.entity';
import { Token } from '../../domain/tokens/entities/token.entity';
import { ProposeTransactionDto } from '../../domain/transactions/entities/propose-transaction.dto.entity';
import { AddConfirmationDto } from '../../domain/transactions/entities/add-confirmation.dto.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheRouter } from '../cache/cache.router';
import { ICacheService } from '../cache/cache.service.interface';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { INetworkService } from '../network/network.service.interface';
import { IConfigurationService } from '../../config/configuration.service.interface';

export class TransactionApi implements ITransactionApi {
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;
  private readonly tokenNotFoundExpirationTimeSeconds: number;
  private readonly contractNotFoundExpirationTimeSeconds: number;

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
    private readonly cacheService: ICacheService,
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    private readonly networkService: INetworkService,
  ) {
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
  }

  async getBalances(args: {
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]> {
    try {
      const cacheDir = CacheRouter.getBalanceCacheDir(
        this.chainId,
        args.safeAddress,
        args.trusted,
        args.excludeSpam,
      );
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/balances/usd/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            trusted: args.trusted,
            exclude_spam: args.excludeSpam,
          },
        },
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearLocalBalances(safeAddress: string): Promise<void> {
    const cacheKey = CacheRouter.getBalancesCacheKey(this.chainId, safeAddress);
    await this.cacheService.deleteByKey(cacheKey);
  }

  async getDataDecoded(args: {
    data: string;
    to?: string;
  }): Promise<DataDecoded> {
    try {
      const url = `${this.baseUrl}/api/v1/data-decoder/`;
      const { data: dataDecoded } = await this.networkService.post(url, {
        data: args.data,
        to: args.to,
      });
      return dataDecoded;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCollectibles(args: {
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>> {
    try {
      const cacheDir = CacheRouter.getCollectiblesCacheDir(
        this.chainId,
        args.safeAddress,
        args.limit,
        args.offset,
        args.trusted,
        args.excludeSpam,
      );
      const url = `${this.baseUrl}/api/v2/safes/${args.safeAddress}/collectibles/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            limit: args.limit,
            offset: args.offset,
            trusted: args.trusted,
            exclude_spam: args.excludeSpam,
          },
        },
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  clearCollectibles(safeAddress: string): Promise<void> {
    const key = CacheRouter.getCollectiblesKey(this.chainId, safeAddress);
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getBackbone(): Promise<Backbone> {
    try {
      const cacheDir = CacheRouter.getBackboneCacheDir(this.chainId);
      const url = `${this.baseUrl}/api/v1/about`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getMasterCopies(): Promise<MasterCopy[]> {
    try {
      const cacheDir = CacheRouter.getMasterCopiesCacheDir(this.chainId);
      const url = `${this.baseUrl}/api/v1/about/master-copies/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getSafe(safeAddress: string): Promise<Safe> {
    try {
      const cacheDir = CacheRouter.getSafeCacheDir(this.chainId, safeAddress);
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearSafe(safeAddress: string): Promise<void> {
    const key = CacheRouter.getSafeCacheKey(this.chainId, safeAddress);
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getContract(contractAddress: string): Promise<Contract> {
    try {
      const cacheDir = CacheRouter.getContractCacheDir(
        this.chainId,
        contractAddress,
      );
      const url = `${this.baseUrl}/api/v1/contracts/${contractAddress}`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.contractNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getDelegates(args: {
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>> {
    try {
      const cacheDir = CacheRouter.getDelegatesCacheDir(
        this.chainId,
        args.safeAddress,
        args.delegate,
        args.delegator,
        args.label,
        args.limit,
        args.offset,
      );
      const url = `${this.baseUrl}/api/v1/delegates/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            safe: args.safeAddress,
            delegate: args.delegate,
            delegator: args.delegator,
            label: args.label,
            limit: args.limit,
            offset: args.offset,
          },
        },
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postDelegate(args: {
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    signature?: string;
    label?: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/delegates/`;
      await this.networkService.post(url, {
        safe: args.safeAddress ?? null, // TODO: this is a workaround while https://github.com/safe-global/safe-transaction-service/issues/1521 is not fixed.
        delegate: args.delegate,
        delegator: args.delegator,
        signature: args.signature,
        label: args.label,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async deleteDelegate(args: {
    delegate: string;
    delegator: string;
    signature: string;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/delegates/${args.delegate}`;
      return await this.networkService.delete(url, {
        delegate: args.delegate,
        delegator: args.delegator,
        signature: args.signature,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async deleteSafeDelegate(args: {
    delegate: string;
    safeAddress: string;
    signature: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/delegates/${args.delegate}`;
      return await this.networkService.delete(url, {
        delegate: args.delegate,
        safe: args.safeAddress,
        signature: args.signature,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getTransfer(transferId: string): Promise<Transfer> {
    try {
      const cacheDir = CacheRouter.getTransferCacheDir(
        this.chainId,
        transferId,
      );
      const url = `${this.baseUrl}/api/v1/transfer/${transferId}`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
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
      const cacheDir = CacheRouter.getTransfersCacheDir(
        this.chainId,
        args.safeAddress,
        args.onlyErc20,
        args.onlyErc721,
        args.limit,
        args.offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/transfers/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            erc20: args.onlyErc20,
            erc721: args.onlyErc721,
            limit: args.limit,
            offset: args.offset,
          },
        },
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  clearTransfers(safeAddress: string): Promise<void> {
    const key = CacheRouter.getTransfersCacheKey(this.chainId, safeAddress);
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  async getIncomingTransfers(args: {
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    try {
      const cacheDir = CacheRouter.getIncomingTransfersCacheDir(
        this.chainId,
        args.safeAddress,
        args.executionDateGte,
        args.executionDateLte,
        args.to,
        args.value,
        args.tokenAddress,
        args.limit,
        args.offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/incoming-transfers/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            execution_date__gte: args.executionDateGte,
            execution_date__lte: args.executionDateLte,
            to: args.to,
            value: args.value,
            tokenAddress: args.tokenAddress,
            limit: args.limit,
            offset: args.offset,
          },
        },
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  clearIncomingTransfers(safeAddress: string): Promise<void> {
    const key = CacheRouter.getIncomingTransfersCacheKey(
      this.chainId,
      safeAddress,
    );

    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  async postConfirmation(
    safeTxHash: string,
    addConfirmationDto: AddConfirmationDto,
  ): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;
      return await this.networkService.post(url, {
        signature: addConfirmationDto.signedSafeTxHash,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getModuleTransaction(
    moduleTransactionId: string,
  ): Promise<ModuleTransaction> {
    try {
      const cacheDir = CacheRouter.getModuleTransactionsCacheDir(
        this.chainId,
        moduleTransactionId,
      );
      const url = `${this.baseUrl}/api/v1/module-transaction/${moduleTransactionId}`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getModuleTransactions(args: {
    safeAddress: string;
    to?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>> {
    try {
      const cacheDir = CacheRouter.getModuleTransactionsCacheDir(
        this.chainId,
        args.safeAddress,
        args.to,
        args.module,
        args.limit,
        args.offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/module-transactions/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            to: args.to,
            module: args.module,
            limit: args.limit,
            offset: args.offset,
          },
        },
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  clearModuleTransactions(safeAddress: string): Promise<void> {
    const key = CacheRouter.getModuleTransactionsCacheKey(
      this.chainId,
      safeAddress,
    );
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  async getMultisigTransactions(args: {
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
      const cacheDir = CacheRouter.getMultisigTransactionsCacheDir(
        this.chainId,
        args.safeAddress,
        args.ordering,
        args.executed,
        args.trusted,
        args.executionDateGte,
        args.executionDateLte,
        args.to,
        args.value,
        args.nonce,
        args.nonceGte,
        args.limit,
        args.offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/multisig-transactions/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
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
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearMultisigTransactions(safeAddress: string): Promise<void> {
    const key = CacheRouter.getMultisigTransactionsCacheKey(
      this.chainId,
      safeAddress,
    );
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  async getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<MultisigTransaction> {
    try {
      const cacheDir = CacheRouter.getMultisigTransactionCacheDir(
        this.chainId,
        safeTransactionHash,
      );
      const url = `${this.baseUrl}/api/v1/multisig-transactions/${safeTransactionHash}/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  clearMultisigTransaction(safeTransactionHash: string): Promise<void> {
    const key = CacheRouter.getMultisigTransactionCacheKey(
      this.chainId,
      safeTransactionHash,
    );
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getCreationTransaction(
    safeAddress: string,
  ): Promise<CreationTransaction> {
    try {
      const cacheDir = CacheRouter.getCreationTransactionCacheDir(
        this.chainId,
        safeAddress,
      );
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/creation/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getAllTransactions(args: {
    safeAddress: string;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    try {
      const cacheDir = CacheRouter.getAllTransactionsCacheDir(
        this.chainId,
        args.safeAddress,
        args.ordering,
        args.executed,
        args.queued,
        args.limit,
        args.offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/all-transactions/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            safe: args.safeAddress,
            ordering: args.ordering,
            executed: args.executed,
            queued: args.queued,
            limit: args.limit,
            offset: args.offset,
          },
        },
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  clearAllTransactions(safeAddress: string): Promise<void> {
    const key = CacheRouter.getAllTransactionsKey(this.chainId, safeAddress);
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getToken(address: string): Promise<Token> {
    try {
      const cacheDir = CacheRouter.getTokenCacheDir(this.chainId, address);
      const url = `${this.baseUrl}/api/v1/tokens/${address}`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.tokenNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getTokens(limit?: number, offset?: number): Promise<Page<Token>> {
    try {
      const cacheDir = CacheRouter.getTokensCacheDir(
        this.chainId,
        limit,
        offset,
      );
      const url = `${this.baseUrl}/api/v1/tokens/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            limit: limit,
            offset: offset,
          },
        },
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [defaultExpirationTimeInSeconds]
  async getSafesByOwner(ownerAddress: string): Promise<SafeList> {
    try {
      const cacheDir = CacheRouter.getSafesByOwnerCacheDir(
        this.chainId,
        ownerAddress,
      );
      const url = `${this.baseUrl}/api/v1/owners/${ownerAddress}/safes/`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postDeviceRegistration(
    device: Device,
    safes: string[],
    signatures: string[],
  ): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/notifications/devices/`;
      await this.networkService.post(url, {
        uuid: device.uuid,
        cloudMessagingToken: device.cloudMessagingToken,
        buildNumber: device.buildNumber,
        bundle: device.bundle,
        deviceType: device.deviceType,
        version: device.version,
        timestamp: device.timestamp,
        safes,
        signatures,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async deleteDeviceRegistration(args: {
    uuid: string;
    safeAddress: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/notifications/devices/${args.uuid}/safes/${args.safeAddress}`;
      await this.networkService.delete(url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getEstimation(
    address: string,
    getEstimationDto: GetEstimationDto,
  ): Promise<Estimation> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${address}/multisig-transactions/estimations/`;
      const { data: estimation } = await this.networkService.post(url, {
        to: getEstimationDto.to,
        value: getEstimationDto.value,
        data: getEstimationDto.data,
        operation: getEstimationDto.operation,
      });
      return estimation;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMessageByHash(messageHash: string): Promise<Message> {
    try {
      const url = `${this.baseUrl}/api/v1/messages/${messageHash}`;
      const cacheDir = CacheRouter.getMessageByHashCacheDir(
        this.chainId,
        messageHash,
      );
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMessagesBySafe(args: {
    safeAddress: string;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Message>> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/messages/`;
      const cacheDir = CacheRouter.getMessagesBySafeCacheDir(
        this.chainId,
        args.safeAddress,
        args.limit,
        args.offset,
      );
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postMultisigTransaction(
    address: string,
    proposeTransactionDto: ProposeTransactionDto,
  ): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${address}/multisig-transactions/`;
      return await this.networkService.post(url, {
        to: proposeTransactionDto.to,
        value: proposeTransactionDto.value,
        data: proposeTransactionDto.data,
        operation: proposeTransactionDto.operation,
        baseGas: proposeTransactionDto.baseGas,
        gasPrice: proposeTransactionDto.gasPrice,
        gasToken: proposeTransactionDto.gasToken,
        refundReceiver: proposeTransactionDto.refundReceiver,
        nonce: proposeTransactionDto.nonce,
        safeTxGas: proposeTransactionDto.safeTxGas,
        contractTransactionHash: proposeTransactionDto.safeTxHash,
        sender: proposeTransactionDto.sender,
        signature: proposeTransactionDto.signature,
        origin: proposeTransactionDto.origin,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postMessage(args: {
    safeAddress: string;
    message: unknown;
    safeAppId: number | null;
    signature: string;
  }): Promise<Message> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/messages/`;
      const { data } = await this.networkService.post(url, {
        message: args.message,
        safeAppId: args.safeAppId,
        signature: args.signature,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postMessageSignature(args: {
    messageHash: string;
    signature: string;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/messages/${args.messageHash}/signatures/`;
      const { data } = await this.networkService.post(url, {
        signature: args.signature,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
