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
      const cacheDir = CacheRouter.getBalanceCacheDir(
        this.chainId,
        safeAddress,
        trusted,
        excludeSpam,
      );
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/balances/usd/`;
      return await this.dataSource.get(cacheDir, url, {
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
    const cacheKey = CacheRouter.getBalancesCacheKey(this.chainId, safeAddress);
    await this.cacheService.deleteByKey(cacheKey);
  }

  async getDataDecoded(data: string, to?: string): Promise<DataDecoded> {
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
      const cacheDir = CacheRouter.getCollectiblesCacheDir(
        this.chainId,
        safeAddress,
        limit,
        offset,
        trusted,
        excludeSpam,
      );
      const url = `${this.baseUrl}/api/v2/safes/${safeAddress}/collectibles/`;
      return await this.dataSource.get(cacheDir, url, {
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

  clearCollectibles(safeAddress: string): Promise<void> {
    const key = CacheRouter.getCollectiblesKey(this.chainId, safeAddress);
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  async getBackbone(): Promise<Backbone> {
    try {
      const cacheDir = CacheRouter.getBackboneCacheDir(this.chainId);
      const url = `${this.baseUrl}/api/v1/about`;
      return await this.dataSource.get(cacheDir, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMasterCopies(): Promise<MasterCopy[]> {
    try {
      const cacheDir = CacheRouter.getMasterCopiesCacheDir(this.chainId);
      const url = `${this.baseUrl}/api/v1/about/master-copies/`;
      return await this.dataSource.get(cacheDir, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getSafe(safeAddress: string): Promise<Safe> {
    try {
      const cacheDir = CacheRouter.getSafeCacheDir(this.chainId, safeAddress);
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}`;
      return await this.dataSource.get(cacheDir, url);
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

  async getContract(contractAddress: string): Promise<Contract> {
    try {
      const cacheDir = CacheRouter.getContractCacheDir(
        this.chainId,
        contractAddress,
      );
      const url = `${this.baseUrl}/api/v1/contracts/${contractAddress}`;
      return await this.dataSource.get(cacheDir, url);
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
      const cacheDir = CacheRouter.getDelegatesCacheDir(
        this.chainId,
        safeAddress,
        delegate,
        delegator,
        label,
        limit,
        offset,
      );
      const url = `${this.baseUrl}/api/v1/delegates/`;
      return await this.dataSource.get(cacheDir, url, {
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

  async deleteSafeDelegate(
    delegate: string,
    safeAddress: string,
    signature: string,
  ): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/delegates/${delegate}`;
      return await this.networkService.delete(url, {
        delegate: delegate,
        safe: safeAddress,
        signature: signature,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getTransfer(transferId: string): Promise<Transfer> {
    try {
      const cacheDir = CacheRouter.getTransferCacheDir(
        this.chainId,
        transferId,
      );
      const url = `${this.baseUrl}/api/v1/transfer/${transferId}`;
      return await this.dataSource.get(cacheDir, url);
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
      const cacheDir = CacheRouter.getTransfersCacheDir(
        this.chainId,
        safeAddress,
        onlyErc20,
        onlyErc721,
        limit,
        offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/transfers/`;
      return await this.dataSource.get(cacheDir, url, {
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

  clearTransfers(safeAddress: string): Promise<void> {
    const key = CacheRouter.getTransfersCacheKey(this.chainId, safeAddress);
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
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
      const cacheDir = CacheRouter.getIncomingTransfersCacheDir(
        this.chainId,
        safeAddress,
        executionDateGte,
        executionDateLte,
        to,
        value,
        tokenAddress,
        limit,
        offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/incoming-transfers/`;
      return await this.dataSource.get(cacheDir, url, {
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
      const url = `${this.baseUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations`;
      return await this.networkService.post(url, {
        signature: addConfirmationDto.signedSafeTxHash,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getModuleTransaction(
    moduleTransactionId: string,
  ): Promise<ModuleTransaction> {
    try {
      const cacheDir = CacheRouter.getModuleTransactionsCacheDir(
        this.chainId,
        moduleTransactionId,
      );
      const url = `${this.baseUrl}/api/v1/module-transaction/${moduleTransactionId}`;
      return await this.dataSource.get(cacheDir, url);
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
      const cacheDir = CacheRouter.getModuleTransactionsCacheDir(
        this.chainId,
        safeAddress,
        to,
        module,
        limit,
        offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/module-transactions/`;
      return await this.dataSource.get(cacheDir, url, {
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

  clearModuleTransactions(safeAddress: string): Promise<void> {
    const key = CacheRouter.getModuleTransactionsCacheKey(
      this.chainId,
      safeAddress,
    );
    return this.cacheService.deleteByKey(key).then(() => {
      return;
    });
  }

  async getMultisigTransactions(
    safeAddress: string,
    ordering?: string,
    executed?: boolean,
    trusted?: boolean,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    nonceGte?: number,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    try {
      const cacheDir = CacheRouter.getMultisigTransactionsCacheDir(
        this.chainId,
        safeAddress,
        ordering,
        executed,
        trusted,
        executionDateGte,
        executionDateLte,
        to,
        value,
        nonce,
        nonceGte,
        limit,
        offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      return await this.dataSource.get(cacheDir, url, {
        params: {
          safe: safeAddress,
          ordering,
          executed,
          trusted,
          execution_date__gte: executionDateGte,
          execution_date__lte: executionDateLte,
          to,
          value,
          nonce,
          nonce__gte: nonceGte,
          limit,
          offset,
        },
      });
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
      return await this.dataSource.get(cacheDir, url);
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

  async getCreationTransaction(
    safeAddress: string,
  ): Promise<CreationTransaction> {
    try {
      const cacheDir = CacheRouter.getCreationTransactionCacheDir(
        this.chainId,
        safeAddress,
      );
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/creation/`;
      return await this.dataSource.get(cacheDir, url);
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
      const cacheDir = CacheRouter.getAllTransactionsCacheDir(
        this.chainId,
        safeAddress,
        ordering,
        executed,
        queued,
        limit,
        offset,
      );
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/all-transactions/`;
      return await this.dataSource.get(cacheDir, url, {
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
      const cacheDir = CacheRouter.getTokenCacheDir(this.chainId, address);
      const url = `${this.baseUrl}/api/v1/tokens/${address}`;
      return await this.dataSource.get(cacheDir, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getTokens(limit?: number, offset?: number): Promise<Page<Token>> {
    try {
      const cacheDir = CacheRouter.getTokensCacheDir(
        this.chainId,
        limit,
        offset,
      );
      const url = `${this.baseUrl}/api/v1/tokens/`;
      return await this.dataSource.get(cacheDir, url, {
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
      const cacheDir = CacheRouter.getSafesByOwnerCacheDir(
        this.chainId,
        ownerAddress,
      );
      const url = `${this.baseUrl}/api/v1/owners/${ownerAddress}/safes/`;
      return await this.dataSource.get(cacheDir, url);
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

  async deleteDeviceRegistration(
    uuid: string,
    safeAddress: string,
  ): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`;
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
      return await this.dataSource.get(cacheDir, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMessagesBySafe(
    safeAddress: string,
    limit?: number | undefined,
    offset?: number | undefined,
  ): Promise<Page<Message>> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/messages/`;
      const cacheDir = CacheRouter.getMessagesBySafeCacheDir(
        this.chainId,
        safeAddress,
        limit,
        offset,
      );
      return await this.dataSource.get(cacheDir, url, {
        params: {
          limit: limit,
          offset: offset,
        },
      });
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
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postMessage(
    safeAddress: string,
    message: unknown,
    safeAppId: number | null,
    signature: string,
  ): Promise<Message> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/messages/`;
      const { data } = await this.networkService.post(url, {
        message,
        safeAppId,
        signature,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postMessageSignature(
    messageHash: string,
    signature: string,
  ): Promise<unknown> {
    try {
      const url = `${this.baseUrl}/api/v1/messages/${messageHash}/signatures/`;
      const { data } = await this.networkService.post(url, { signature });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
