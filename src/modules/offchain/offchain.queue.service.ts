// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  OffchainMultisigTransactionPageSchema,
  OffchainMultisigTransactionSchema,
} from '@/modules/offchain/entities/multisig-transaction.entity';
import {
  OffchainMessagePageSchema,
  OffchainMessageSchema,
} from '@/modules/offchain/entities/message.entity';
import { OffchainDelegatePageSchema } from '@/modules/offchain/entities/delegate.entity';
import { OffchainErrorMapper } from '@/modules/offchain/mappers/error.mapper';
import { mapOffchainToMultisigTransaction } from '@/modules/offchain/mappers/transaction.mapper';
import { mapOffchainToMessage } from '@/modules/offchain/mappers/message.mapper';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type {
  IOffchain,
  OffchainMultisigTransaction,
} from '@/modules/offchain/offchain.interface';
import { rawify } from '@/validation/entities/raw.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import type { Address, Hex } from 'viem';

@Injectable()
export class OffchainQueueService implements IOffchain {
  private readonly baseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly errorMapper: OffchainErrorMapper,
  ) {
    this.baseUri = this.configurationService.getOrThrow<string>(
      'queueService.baseUri',
    );
  }

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: Address;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown> {
    try {
      const dto = args.proposeTransactionDto;
      const { originName, originUrl } = this.parseOrigin(dto.origin);

      const url = `${this.baseUri}/api/v1/chains/${args.chainId}/safes/${args.safeAddress}/multisig-transactions`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: {
          to: dto.to,
          value: Number(dto.value),
          data: dto.data,
          nonce: Number(dto.nonce),
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
      return data;
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getMultisigTransaction(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<Raw<MultisigTransaction>> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/${args.safeTxHash}`;
      const { data } = await this.networkService.get<unknown>({ url });
      const parsed = OffchainMultisigTransactionSchema.parse(data);
      return rawify(mapOffchainToMultisigTransaction(parsed));
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getTransactionQueue(args: {
    chainId: string;
    safeAddress: Address;
    ordering?: string;
    trusted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/queue`;
      const nonceOrder = args.ordering?.includes('-') ? 'desc' : 'asc';
      const { data } = await this.networkService.get<unknown>({
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
      const parsed = OffchainMultisigTransactionPageSchema.parse(data);
      return rawify({
        count: parsed.count,
        next: parsed.next,
        previous: parsed.previous,
        results: parsed.results.map(mapOffchainToMultisigTransaction),
      });
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async postConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUri}/api/v1/multisig-transactions/${args.safeTxHash}/confirmations`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: { signatures: [args.signature] },
      });
      return data;
    } catch (error) {
      throw this.errorMapper.from(error);
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
      throw this.errorMapper.from(error);
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
      const url = `${this.baseUri}/api/v1/delegates`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          params: {
            chain_id: Number(args.chainId),
            safe: args.safeAddress,
            delegate: args.delegate,
            delegator: args.delegator,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      const parsed = OffchainDelegatePageSchema.parse(data);
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
      throw this.errorMapper.from(error);
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
      throw this.errorMapper.from(error);
    }
  }

  async getMessageByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<Raw<Message>> {
    try {
      const url = `${this.baseUri}/api/v1/messages/${args.messageHash}`;
      const { data } = await this.networkService.get<unknown>({ url });
      const parsed = OffchainMessageSchema.parse(data);
      return rawify(mapOffchainToMessage(parsed));
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Message>>> {
    try {
      const url = `${this.baseUri}/api/v1/safes/${args.safeAddress}/messages`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          params: {
            chain_id: Number(args.chainId),
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      const parsed = OffchainMessagePageSchema.parse(data);
      return rawify({
        count: parsed.count,
        next: parsed.next,
        previous: parsed.previous,
        results: parsed.results.map(mapOffchainToMessage),
      });
    } catch (error) {
      throw this.errorMapper.from(error);
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
      const { originName, originUrl } = this.parseOrigin(args.origin);
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
      throw this.errorMapper.from(error);
    }
  }

  async postMessageSignature(args: {
    chainId: string;
    messageHash: string;
    signature: Hex;
  }): Promise<unknown> {
    try {
      const url = `${this.baseUri}/api/v1/messages/${args.messageHash}/signatures`;
      const { data } = await this.networkService.post<unknown>({
        url,
        data: { signatures: [args.signature] },
      });
      return data;
    } catch (error) {
      throw this.errorMapper.from(error);
    }
  }

  async getTransactionMetadataBatch(args: {
    safeTxHashes: Array<string>;
  }): Promise<Map<string, OffchainMultisigTransaction>> {
    const results = new Map<string, OffchainMultisigTransaction>();
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
          } satisfies OffchainMultisigTransaction,
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

  /**
   * Parses the TX service origin JSON string into separate
   * originName/originUrl fields for the queue service.
   */
  private parseOrigin(origin: string | null): {
    originName?: string;
    originUrl?: string;
  } {
    if (!origin) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(origin);
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        return {
          originName: typeof obj.name === 'string' ? obj.name : undefined,
          originUrl: typeof obj.url === 'string' ? obj.url : undefined,
        };
      }
      return {};
    } catch {
      return {};
    }
  }
}
