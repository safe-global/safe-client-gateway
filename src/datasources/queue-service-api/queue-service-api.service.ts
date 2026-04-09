// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  QueueMultisigTransactionPageSchema,
  QueueMultisigTransactionSchema,
} from '@/datasources/queue-service-api/entities/queue-multisig-transaction.entity';
import {
  QueueMessagePageSchema,
  QueueMessageSchema,
} from '@/datasources/queue-service-api/entities/queue-message.entity';
import { QueueDelegatePageSchema } from '@/datasources/queue-service-api/entities/queue-delegate.entity';
import { QueueServiceErrorMapper } from '@/datasources/queue-service-api/mappers/queue-error.mapper';
import { mapQueueToMultisigTransaction } from '@/datasources/queue-service-api/mappers/queue-to-transaction.mapper';
import { mapQueueToMessage } from '@/datasources/queue-service-api/mappers/queue-to-message.mapper';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type {
  IQueueServiceApi,
  QueueMultisigTransaction,
  QueueProposeTransactionDto,
} from '@/datasources/queue-service-api/queue-service-api.interface';
import { rawify } from '@/validation/entities/raw.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import type { Address } from 'viem';

@Injectable()
export class QueueServiceApi implements IQueueServiceApi {
  private readonly baseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly errorMapper: QueueServiceErrorMapper,
  ) {
    this.baseUri = this.configurationService.getOrThrow<string>(
      'queueService.baseUri',
    );
  }

  async proposeTransaction(args: {
    chainId: string;
    safe: Address;
    data: QueueProposeTransactionDto;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUri}/api/v1/chains/${args.chainId}/safes/${args.safe}/multisig-transactions`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: args.data,
      });
      return data;
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getMultisigTransaction(
    safeTxHash: string,
  ): Promise<Raw<MultisigTransaction>> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/${safeTxHash}`;
      const { data } = await this.networkService.get<unknown>({ url });
      const parsed = QueueMultisigTransactionSchema.parse(data);
      return rawify(mapQueueToMultisigTransaction(parsed));
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getTransactionQueue(args: {
    safes: Array<string>;
    nonceOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/queue`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          params: {
            safes: args.safes.join(','),
            nonce_order: args.nonceOrder,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      const parsed = QueueMultisigTransactionPageSchema.parse(data);
      return rawify({
        count: parsed.count,
        next: parsed.next,
        previous: parsed.previous,
        results: parsed.results.map(mapQueueToMultisigTransaction),
      });
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getMultisigTransactions(args: {
    safes: Array<string>;
    executed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          params: {
            safes: args.safes.join(','),
            executed: args.executed,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      const parsed = QueueMultisigTransactionPageSchema.parse(data);
      return rawify({
        count: parsed.count,
        next: parsed.next,
        previous: parsed.previous,
        results: parsed.results.map(mapQueueToMultisigTransaction),
      });
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async postConfirmation(args: {
    safeTxHash: string;
    signatures: Array<string>;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/${args.safeTxHash}/confirmations`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: { signatures: args.signatures },
      });
      return data;
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async deleteTransaction(args: {
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
      throw this.errorMapper.from(error);
    }
  }

  async getDelegates(args: {
    chainId?: number;
    safe?: Address;
    delegate?: Address;
    delegator?: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>> {
    try {
      const url = `${this.baseUri}/api/v1/delegates`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          params: {
            chain_id: args.chainId,
            safe: args.safe,
            delegate: args.delegate,
            delegator: args.delegator,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      const parsed = QueueDelegatePageSchema.parse(data);
      return rawify({
        count: parsed.count,
        next: parsed.next,
        previous: parsed.previous,
        results: parsed.results.map((d) => ({
          safe: d.safe,
          delegate: d.delegate,
          delegator: d.delegator,
          label: d.label ?? '',
        })),
      });
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async postDelegate(args: {
    delegate: Address;
    delegator: Address;
    signature: string;
    chainId?: number;
    safe?: Address;
    label?: string;
  }): Promise<void> {
    try {
      const url = `${this.baseUri}/api/v1/delegates`;
      await this.networkService.post({
        url,
        data: {
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          chain_id: args.chainId,
          safe: args.safe,
          label: args.label,
        },
      });
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async deleteDelegate(args: {
    delegate: Address;
    delegator: Address;
    signature: string;
    chainId?: number;
    safe?: Address;
  }): Promise<void> {
    try {
      const url = `${this.baseUri}/api/v1/delegates/${args.delegate}`;
      await this.networkService.delete({
        url,
        data: {
          delegator: args.delegator,
          signature: args.signature,
          chain_id: args.chainId,
          safe: args.safe,
        },
      });
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getMessageByHash(messageHash: string): Promise<Raw<Message>> {
    try {
      const url = `${this.baseUri}/api/v1/messages/${messageHash}`;
      const { data } = await this.networkService.get<unknown>({ url });
      const parsed = QueueMessageSchema.parse(data);
      return rawify(mapQueueToMessage(parsed));
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getMessagesBySafe(args: {
    safeAddress: Address;
    chainId?: number;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Message>>> {
    try {
      const url = `${this.baseUri}/api/v1/safes/${args.safeAddress}/messages`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          params: {
            chain_id: args.chainId,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      const parsed = QueueMessagePageSchema.parse(data);
      return rawify({
        count: parsed.count,
        next: parsed.next,
        previous: parsed.previous,
        results: parsed.results.map(mapQueueToMessage),
      });
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async postMessage(args: {
    safeAddress: Address;
    chainId: number;
    message: unknown;
    signatures: Array<string>;
    originName?: string;
    originUrl?: string;
  }): Promise<Raw<Message>> {
    try {
      const url = `${this.baseUri}/api/v1/safes/${args.safeAddress}/messages`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: {
          chain_id: args.chainId,
          message: args.message,
          signatures: args.signatures,
          origin_name: args.originName,
          origin_url: args.originUrl,
        },
      });
      const parsed = QueueMessageSchema.parse(data);
      return rawify(mapQueueToMessage(parsed));
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async postMessageSignature(args: {
    messageHash: string;
    signatures: Array<string>;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUri}/api/v1/messages/${args.messageHash}/signatures`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: { signatures: args.signatures },
      });
      return data;
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getTransactionMetadataBatch(args: {
    safeTxHashes: Array<string>;
  }): Promise<Map<string, QueueMultisigTransaction>> {
    const results = new Map<string, QueueMultisigTransaction>();
    if (args.safeTxHashes.length === 0) return results;

    const settled = await Promise.allSettled(
      args.safeTxHashes.map(async (hash) => {
        const url = `${this.baseUri}/api/v1/multisig-transactions/${hash}`;
        const { data } = await this.networkService.get<unknown>({ url });
        const raw = data as unknown as Record<string, unknown>;
        return {
          hash,
          tx: {
            safeTxHash: hash,
            proposer: (raw.proposer as Address) ?? null,
            proposedByDelegate: (raw.proposedByDelegate as Address) ?? null,
            originName:
              typeof raw.originName === 'string' ? raw.originName : null,
            originUrl: typeof raw.originUrl === 'string' ? raw.originUrl : null,
          } satisfies QueueMultisigTransaction,
        };
      }),
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.hash, result.value.tx);
      } else {
        this.loggingService.warn(
          `Queue service metadata fetch failed: ${result.reason}`,
        );
      }
    }

    return results;
  }
}
