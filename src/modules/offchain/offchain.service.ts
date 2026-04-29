// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  OffchainMultisigTransactionPageSchema,
  OffchainMultisigTransactionSchema,
} from '@/modules/offchain/entities/multisig-transaction.entity';
import type { OffchainMultisigTransactionEntity } from '@/modules/offchain/entities/multisig-transaction.entity';
import {
  OffchainMessage,
  OffchainMessageSchema,
} from '@/modules/offchain/entities/message.entity';
import { parseOrigin } from '@/modules/offchain/helpers/origin.helper';
import { mapOffchainToMessage } from '@/modules/offchain/mappers/message.mapper';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type { IOffchain } from '@/modules/offchain/offchain.interface';
import { rawify } from '@/validation/entities/raw.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';

@Injectable()
export class OffchainService implements IOffchain {
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
          to: dto.to,
          value: Number(dto.value),
          data: dto.data,
          nonce: dto.nonce,
          operation: dto.operation,
          safeTxGas: Number(dto.safeTxGas),
          baseGas: Number(dto.baseGas),
          gasPrice: Number(dto.gasPrice),
          gasToken: dto.gasToken,
          refundReceiver: dto.refundReceiver,
          safeTxHash: dto.safeTxHash,
          proposer: dto.sender,
          signature: dto.signature ?? '',
          originName,
          originUrl,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMultisigTransaction(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<Raw<OffchainMultisigTransactionEntity>> {
    try {
      const cacheDir = CacheRouter.getMultisigTransactionCacheDir({
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
      return rawify(OffchainMultisigTransactionSchema.parse(data));
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getMultisigTransactions(args: {
    chainId: string;
    safeAddress: Address;
    ordering?: string;
    executed?: boolean;
    trusted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<OffchainMultisigTransactionEntity>>> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions`;
      const { data } = await this.networkService.get({
        url,
        networkRequest: {
          params: {
            safe: args.safeAddress,
            chain_id: Number(args.chainId),
            ordering: args.ordering,
            executed: args.executed,
            trusted: args.trusted,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return rawify(OffchainMultisigTransactionPageSchema.parse(data));
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
  }): Promise<Raw<Page<OffchainMultisigTransactionEntity>>> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/queue`;
      const nonceOrder = args.ordering?.includes('-') ? 'desc' : 'asc';
      const { data } = await this.networkService.get({
        url,
        networkRequest: {
          params: {
            safes: `${args.safeAddress}:${args.chainId}`,
            nonce_order: nonceOrder,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return rawify(OffchainMultisigTransactionPageSchema.parse(data));
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
      const cacheDir = CacheRouter.getDelegatesCacheDir(args);
      const url = `${this.baseUri}/api/v1/delegates`;
      const data = await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        networkRequest: {
          params: {
            chain_id: args.chainId,
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
          chain_id: Number(args.chainId),
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
      const url = `${this.baseUri}/api/v1/delegates/${args.delegate}`;
      await this.networkService.delete({
        url,
        data: {
          delegator: args.delegator,
          signature: args.signature,
          chain_id: Number(args.chainId),
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
  }): Promise<Raw<OffchainMessage>> {
    try {
      const cacheDir = CacheRouter.getMessageByHashCacheDir({
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
  }): Promise<Raw<Page<OffchainMessage>>> {
    try {
      const cacheDir = CacheRouter.getMessagesBySafeCacheDir({
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
            chain_id: args.chainId,
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
    safeAppId: number | null;
    signature: string;
    origin: string | null;
  }): Promise<Raw<Message>> {
    try {
      const { originName, originUrl } = parseOrigin(args.origin);
      const url = `${this.baseUri}/api/v1/safes/${args.safeAddress}/messages`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: {
          chain_id: Number(args.chainId),
          message: args.message,
          signatures: [args.signature],
          origin_name: originName,
          origin_url: originUrl,
        },
      });
      const parsed = OffchainMessageSchema.parse(data);
      return rawify(mapOffchainToMessage(parsed));
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
    const key = CacheRouter.getMultisigTransactionCacheKey({
      chainId: args.chainId,
      safeTransactionHash: args.safeTxHash,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const key = CacheRouter.getMultisigTransactionsCacheKey({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearAllTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const key = CacheRouter.getAllTransactionsKey({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const key = CacheRouter.getMessagesBySafeCacheKey({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    const key = CacheRouter.getMessageByHashCacheKey({
      chainId: args.chainId,
      messageHash: args.messageHash,
    });
    await this.cacheService.deleteByKey(key);
  }

  async clearDelegates(args: {
    chainId: string;
    safeAddress?: Address;
  }): Promise<void> {
    const key = CacheRouter.getDelegatesCacheKey({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }
}
