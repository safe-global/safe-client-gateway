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
import { CircuitBreakerKeys } from '@/datasources/circuit-breaker/circuit-breaker.keys';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { Page } from '@/domain/entities/page.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { QueueMessage } from '@/modules/queue/entities/message.entity';
import type { QueueMultisigTransactionEntity } from '@/modules/queue/entities/multisig-transaction.entity';
import {
  QueueMultisigTransactionListSchema,
  QueueMultisigTransactionSchema,
} from '@/modules/queue/entities/multisig-transaction.entity';
import { parseOrigin } from '@/modules/queue/helpers/origin.helper';
import type { IQueueService } from '@/modules/queue/queue.interface';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import { rawify } from '@/validation/entities/raw.entity';

@Injectable()
export class QueueService implements IQueueService {
  // Chunk size for multisig batch fetches. Each `safe_tx_hash=0x<64 hex>&`
  // pair is ~81 bytes; nginx's default `large_client_header_buffers 4 8k`
  // and many WAFs reject request lines beyond 8KB, so we cap each call at
  // 50 hashes (~4KB URL) to stay safely under that limit.
  private static readonly MAX_BATCH_HASHES_PER_CALL = 50;

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
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
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
  }): Promise<Raw<QueueMultisigTransactionEntity>> {
    try {
      const dto = args.proposeTransactionDto;
      const { originName, originUrl, note } = parseOrigin(dto.origin);

      const url = `${this.baseUri}/api/v1/multisig-transactions`;
      const { data } = await this.networkService.post({
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
          notes: note ?? null,
          signatures: dto.signature ? [dto.signature] : [],
        },
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
        },
      });
      return rawify(QueueMultisigTransactionSchema.parse(data));
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
      const url = `${this.baseUri}/api/v1/multisig-transactions/${encodeURIComponent(args.safeTxHash)}`;
      const data = await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
        },
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
      if (args.safeTxHashes.length === 0) {
        return rawify([]);
      }
      const chunkSize = QueueService.MAX_BATCH_HASHES_PER_CALL;
      const chunks: Array<ReadonlyArray<string>> = [];
      for (let i = 0; i < args.safeTxHashes.length; i += chunkSize) {
        chunks.push(args.safeTxHashes.slice(i, i + chunkSize));
      }
      // Use allSettled so a single failing chunk (e.g. a 5xx) doesn't discard
      // the transactions returned by the other chunks. Hashes belonging to a
      // failed chunk simply won't appear in the merged result; we log those
      // omissions below, preserving partial enrichment.
      const responses = await Promise.allSettled(
        chunks.map((chunk) => {
          const query = new URLSearchParams();
          for (const hash of chunk) {
            query.append('safe_tx_hash', hash);
          }
          const url = `${this.baseUri}/api/v1/multisig-transactions/batch?${query.toString()}`;
          return this.networkService.get({
            url,
            networkRequest: {
              circuitBreaker: {
                key: CircuitBreakerKeys.getQueueServiceKey(),
              },
            },
          });
        }),
      );
      const merged = responses.flatMap((response, index) => {
        let error: unknown;
        if (response.status === 'fulfilled') {
          // safeParse rather than parse: a fulfilled chunk with a malformed
          // body must be dropped like a rejected one, not thrown synchronously
          // out of flatMap into the outer catch — that would discard the whole
          // batch and defeat the partial-enrichment allSettled buys us above.
          const parsed = QueueMultisigTransactionListSchema.safeParse(
            response.value.data,
          );
          if (parsed.success) {
            return parsed.data;
          }
          error = parsed.error;
        } else {
          error = response.reason;
        }
        this.loggingService.warn({
          type: LogType.QueueServiceBatchChunkError,
          chainId: args.chainId,
          safeTxHashes: chunks[index],
          error: asError(error),
        });
        return [];
      });
      return rawify(merged);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getTransactionQueue(args: {
    chainId: string;
    safeAddress: Address;
    nonceOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<QueueMultisigTransactionEntity>>> {
    try {
      const cacheDir = CacheRouter.getQueuedTransactionsCacheDir(args);
      const url = `${this.baseUri}/api/v1/multisig-transactions/queue`;
      const nonceOrder = args.nonceOrder ?? 'asc';
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
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
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
  }): Promise<Raw<QueueMultisigTransactionEntity>> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/${encodeURIComponent(args.safeTxHash)}/signatures`;
      const { data } = await this.networkService.post({
        url,
        data: { signatures: [args.signature] },
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
        },
      });
      return rawify(QueueMultisigTransactionSchema.parse(data));
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
      const url = `${this.baseUri}/api/v1/multisig-transactions/${encodeURIComponent(args.safeTxHash)}`;
      await this.networkService.delete({
        url,
        data: { signature: args.signature },
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
        },
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
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
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
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async updateDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUri}/api/v1/delegates`;
      await this.networkService.patch({
        url,
        data: {
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          chainId: Number(args.chainId),
          safe: args.safeAddress ?? undefined,
          label: args.label,
        },
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
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
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
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
      const url = `${this.baseUri}/api/v1/messages/${encodeURIComponent(args.messageHash)}`;
      const data = await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
        },
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
      const url = `${this.baseUri}/api/v1/safes/${encodeURIComponent(args.safeAddress)}/messages`;
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
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
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
      // Deliberately drop `note`: it's a transaction-only concept, and the
      // read path (message.mapper) omits it too, so messages keep their
      // `{name, url}` origin shape on the way in and out.
      const { originName, originUrl } = parseOrigin(args.origin);
      const url = `${this.baseUri}/api/v1/safes/${encodeURIComponent(args.safeAddress)}/messages`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: {
          chainId: Number(args.chainId),
          message: args.message,
          signatures: [args.signature],
          originName,
          originUrl,
        },
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
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
      const url = `${this.baseUri}/api/v1/messages/${encodeURIComponent(args.messageHash)}/signatures`;
      const { data } = await this.networkService.post({
        url,
        data: { signatures: [args.signature] },
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getQueueServiceKey(),
          },
        },
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
