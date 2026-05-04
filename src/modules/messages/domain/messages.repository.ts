// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@/domain/entities/page.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  Message,
  MessagePageSchema,
  MessageSchema,
} from '@/modules/messages/domain/entities/message.entity';
import { IMessagesRepository } from '@/modules/messages/domain/messages.repository.interface';
import { MessageVerifierHelper } from '@/modules/messages/domain/helpers/message-verifier.helper';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { TypedData } from '@/modules/messages/domain/entities/typed-data.entity';
import { IQueue } from '@/modules/queue/queue.interface';
import type { Address, Hash, Hex } from 'viem';
import {
  QueueMessagePageSchema,
  QueueMessageSchema,
} from '@/modules/queue/entities/message.entity';
import { mapQueueToMessage } from '@/modules/queue/mappers/message.mapper';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  private readonly queueServiceEnabled: boolean;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IQueue)
    private readonly queueService: IQueue,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly messageVerifier: MessageVerifierHelper,
  ) {
    this.queueServiceEnabled = this.configurationService.getOrThrow<boolean>(
      'features.queueService',
    );
  }

  async getMessageByHash(args: {
    chainId: string;
    messageHash: Hash;
  }): Promise<Message> {
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      const message = await transactionService.getMessageByHash(
        args.messageHash,
      );
      return MessageSchema.parse(message);
    }
    const message = await this.queueService.getMessageByHash(args);
    return mapQueueToMessage(QueueMessageSchema.parse(message));
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>> {
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      const page = await transactionService.getMessagesBySafe({
        safeAddress: args.safeAddress,
        limit: args.limit,
        offset: args.offset,
      });
      return MessagePageSchema.parse(page);
    }
    const page = await this.queueService.getMessagesBySafe(args);
    const parsed = QueueMessagePageSchema.parse(page);
    return {
      ...parsed,
      results: parsed.results.map(mapQueueToMessage),
    };
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
    if (!this.queueServiceEnabled) {
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
    }
    return this.queueService.postMessage(args);
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
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      return transactionService.postMessageSignature({
        messageHash: args.messageHash,
        signature: args.signature,
      });
    }
    return this.queueService.postMessageSignature(args);
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      await transactionService.clearMessagesBySafe(args);
      return;
    }
    await this.queueService.clearMessagesBySafe(args);
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      await transactionService.clearMessagesByHash(args);
      return;
    }
    await this.queueService.clearMessagesByHash(args);
  }
}
