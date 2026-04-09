import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Message } from '@/modules/messages/domain/entities/message.entity';
import { IMessagesRepository } from '@/modules/messages/domain/messages.repository.interface';
import {
  MessagePageSchema,
  MessageSchema,
} from '@/modules/messages/domain/entities/message.entity';
import { MessageVerifierHelper } from '@/modules/messages/domain/helpers/message-verifier.helper';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { TypedData } from '@/modules/messages/domain/entities/typed-data.entity';
import { IQueueServiceApi } from '@/datasources/queue-service-api/queue-service-api.interface';
import { QueueServiceRoutingHelper } from '@/datasources/queue-service-api/queue-service-routing.helper';
import type { Address, Hash, Hex } from 'viem';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IQueueServiceApi)
    private readonly queueServiceApi: IQueueServiceApi,
    private readonly messageVerifier: MessageVerifierHelper,
    private readonly queueServiceRouting: QueueServiceRoutingHelper,
  ) {}

  async getMessageByHash(args: {
    chainId: string;
    messageHash: Hash;
  }): Promise<Message> {
    const message = await this.queueServiceRouting.route({
      whenEnabled: () =>
        this.queueServiceApi.getMessageByHash(args.messageHash),
      whenDisabled: async () => {
        const transactionService = await this.transactionApiManager.getApi(
          args.chainId,
        );
        return transactionService.getMessageByHash(args.messageHash);
      },
    });
    return MessageSchema.parse(message);
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Message>> {
    const page = await this.queueServiceRouting.route({
      whenEnabled: () =>
        this.queueServiceApi.getMessagesBySafe({
          safeAddress: args.safeAddress,
          chainId: Number(args.chainId),
          limit: args.limit,
          offset: args.offset,
        }),
      whenDisabled: async () => {
        const transactionService = await this.transactionApiManager.getApi(
          args.chainId,
        );
        return transactionService.getMessagesBySafe({
          safeAddress: args.safeAddress,
          limit: args.limit,
          offset: args.offset,
        });
      },
    });

    return MessagePageSchema.parse(page);
  }

  async createMessage(args: {
    chainId: string;
    safeAddress: Address;
    message: string | TypedData;
    safeAppId: number | null;
    signature: Hex;
    origin: string | null;
  }): Promise<unknown> {
    const safe = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    this.messageVerifier.verifyCreation({
      chainId: args.chainId,
      safe,
      message: args.message,
      signature: args.signature,
    });
    return this.queueServiceRouting.route({
      whenEnabled: () => {
        const { originName, originUrl } = this.parseOrigin(args.origin);
        return this.queueServiceApi.postMessage({
          safeAddress: args.safeAddress,
          chainId: Number(args.chainId),
          message: args.message,
          signatures: [args.signature],
          originName,
          originUrl,
        });
      },
      whenDisabled: async () => {
        const transactionService = await this.transactionApiManager.getApi(
          args.chainId,
        );
        return transactionService.postMessage({
          safeAddress: args.safeAddress,
          message: args.message,
          safeAppId: args.safeAppId,
          signature: args.signature,
          origin: args.origin,
        });
      },
    });
  }

  async updateMessageSignature(args: {
    chainId: string;
    messageHash: Hash;
    signature: Hex;
  }): Promise<unknown> {
    const message = await this.getMessageByHash({
      chainId: args.chainId,
      messageHash: args.messageHash,
    });
    const safe = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: message.safe,
    });
    this.messageVerifier.verifyUpdate({
      ...args,
      safe,
      message: message.message,
    });
    return this.queueServiceRouting.route({
      whenEnabled: () =>
        this.queueServiceApi.postMessageSignature({
          messageHash: args.messageHash,
          signatures: [args.signature],
        }),
      whenDisabled: async () => {
        const transactionService = await this.transactionApiManager.getApi(
          args.chainId,
        );
        return transactionService.postMessageSignature({
          messageHash: args.messageHash,
          signature: args.signature,
        });
      },
    });
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    await api.clearMessagesBySafe(args);
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    await api.clearMessagesByHash(args);
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
