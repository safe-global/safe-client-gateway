// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { QueueMessage } from '@/modules/queue/entities/message.entity';
import type { QueueMultisigTransactionEntity } from '@/modules/queue/entities/multisig-transaction.entity';
import {
  QueueMultisigTransactionListSchema,
  QueueMultisigTransactionSchema,
} from '@/modules/queue/entities/multisig-transaction.entity';
import { parseOrigin } from '@/modules/queue/helpers/origin.helper';
import type { IQueue } from '@/modules/queue/queue.interface';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import { rawify } from '@/validation/entities/raw.entity';

@Injectable()
export class QueueService implements IQueue {
  private readonly baseUri: string;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    private readonly dataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri = this.configurationService.getOrThrow<string>(
      'queueService.baseUri',
    );
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: Address;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown> {
    try {
      const dto = args.proposeTransactionDto;
      const { originName, originUrl } = parseOrigin(dto.origin);

      const url = `${this.baseUri}/api/v1/multisig-transactions`;
      return await this.networkService.post({
        url,
        data: {
          chainId: Number(args.chainId),
          safe: args.safeAddress,
          to: dto.to,
          value: dto.value,
          data: dto.data,
          nonce: Number(dto.nonce),
          operation: dto.operation,
          safeTxGas: dto.safeTxGas,
          baseGas: dto.baseGas,
          gasPrice: dto.gasPrice,
          gasToken: dto.gasToken,
          refundReceiver: dto.refundReceiver,
          originName,
          originUrl,
          signatures: dto.signature ? [dto.signature] : [],
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMultisigTransaction(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<Raw<QueueMultisigTransactionEntity>> {
    try {
      const cacheDir = CacheRouter.getQueueMultisigTransactionCacheDir({
        chainId: args.chainId,
        safeTransactionHash: args.safeTxHash,
      });
      const url = `${this.baseUri}/api/v1/multisig-transactions/${args.safeTxHash}`;
      const data = await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return rawify(QueueMultisigTransactionSchema.parse(data));
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMultisigTransactionsBatch(args: {
    chainId: string;
    safeTxHashes: ReadonlyArray<string>;
  }): Promise<Raw<Array<QueueMultisigTransactionEntity>>> {
    try {
      const query = new URLSearchParams();
      for (const hash of args.safeTxHashes) {
        query.append('safe_tx_hash', hash);
      }
      const url = `${this.baseUri}/api/v1/multisig-transactions/batch?${query.toString()}`;
      const { data } = await this.networkService.get({ url });
      return rawify(QueueMultisigTransactionListSchema.parse(data));
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getTransactionQueue(args: {
    chainId: string;
    safeAddress: Address;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<QueueMultisigTransactionEntity>>> {
    try {
      const cacheDir = CacheRouter.getQueuedTransactionsCacheDir(args);
      const url = `${this.baseUri}/api/v1/multisig-transactions/queue`;
      const nonceOrder = args.ordering?.includes('-') ? 'desc' : 'asc';
      return await this.dataSource.get<Page<QueueMultisigTransactionEntity>>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        networkRequest: {
          params: {
            safes: `${args.safeAddress}:${args.chainId}`,
            nonce_order: nonceOrder,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/${args.safeTxHash}/signatures`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: { signatures: [args.signature] },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/${args.safeTxHash}`;
      await this.networkService.delete({
        url,
        data: { signature: args.signature },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getDelegates(args: {
    chainId: string;
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>> {
    try {
      const cacheDir = CacheRouter.getQueueDelegatesCacheDir(args);
      const url = `${this.baseUri}/api/v1/delegates`;
      const data = await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        networkRequest: {
          params: {
            chainId: Number(args.chainId),
            safe: args.safeAddress,
            delegate: args.delegate,
            delegator: args.delegator,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUri}/api/v1/delegates`;
      await this.networkService.post({
        url,
        data: {
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          chainId: Number(args.chainId),
          safe: args.safeAddress ?? undefined,
          label: args.label,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUri}/api/v1/delegates`;
      await this.networkService.delete({
        url,
        data: {
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          chainId: Number(args.chainId),
          safe: args.safeAddress ?? undefined,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMessageByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<Raw<QueueMessage>> {
    try {
      const cacheDir = CacheRouter.getQueueMessageByHashCacheDir({
        chainId: args.chainId,
        messageHash: args.messageHash,
      });
      const url = `${this.baseUri}/api/v1/messages/${args.messageHash}`;
      const data = await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<QueueMessage>>> {
    try {
      const cacheDir = CacheRouter.getQueueMessagesBySafeCacheDir({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        limit: args.limit,
        offset: args.offset,
      });
      const url = `${this.baseUri}/api/v1/safes/${args.safeAddress}/messages`;
      const data = await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        networkRequest: {
          params: {
            chainId: Number(args.chainId),
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postMessage(args: {
    chainId: string;
    safeAddress: Address;
    message: unknown;
    signature: string;
    origin: string | null;
  }): Promise<unknown> {
    try {
      const { originName, originUrl } = parseOrigin(args.origin);
      const url = `${this.baseUri}/api/v1/safes/${args.safeAddress}/messages`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: {
          chainId: Number(args.chainId),
          message: args.message,
          signatures: [args.signature],
          originName,
          originUrl,
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async postMessageSignature(args: {
    chainId: string;
    messageHash: string;
    signature: Hex;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUri}/api/v1/messages/${args.messageHash}/signatures`;
      const { data } = await this.networkService.post({
        url,
        data: { signatures: [args.signature] },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearMultisigTransaction(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<void> {
    const key = CacheRouter.getQueueMultisigTransactionCacheKey({
      chainId: args.chainId,
      safeTransactionHash: args.safeTxHash,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearAllTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const key = CacheRouter.getQueueMultisigTransactionsCacheKey({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const key = CacheRouter.getQueueMessagesBySafeCacheKey({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    const key = CacheRouter.getQueueMessageByHashCacheKey({
      chainId: args.chainId,
      messageHash: args.messageHash,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearDelegates(args: {
    chainId: string;
    safeAddress?: Address;
  }): Promise<void> {
    const key = CacheRouter.getQueueDelegatesCacheKey({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }
}
