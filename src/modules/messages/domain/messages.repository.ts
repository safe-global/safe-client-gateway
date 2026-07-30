// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hash, Hex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  Message,
  MessagePageSchema,
  MessageSchema,
} from '@/modules/messages/domain/entities/message.entity';
import { TypedData } from '@/modules/messages/domain/entities/typed-data.entity';
import { MessageVerifierHelper } from '@/modules/messages/domain/helpers/message-verifier.helper';
import { IMessagesRepository } from '@/modules/messages/domain/messages.repository.interface';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import {
  SafeQueueMessagePageSchema,
  SafeQueueMessageSchema,
} from '@/modules/safe-queue/entities/message.entity';
import { clearBothCacheLayers } from '@/modules/safe-queue/helpers/clear-cache-layers.helper';
import { mapSafeQueueMessageToMessage } from '@/modules/safe-queue/mappers/message.mapper';
import { ISafeQueueService } from '@/modules/safe-queue/safe-queue.interface';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  private readonly safeQueueEnabled: boolean;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(ISafeQueueService)
    private readonly safeQueueService: ISafeQueueService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly messageVerifier: MessageVerifierHelper,
  ) {
    this.safeQueueEnabled = this.configurationService.getOrThrow<boolean>(
      'features.safeQueueService',
    );
  }

  async getMessageByHash(args: {
    chainId: string;
    messageHash: Hash;
  }): Promise<Message> {
    if (!this.safeQueueEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      const message = await transactionService.getMessageByHash(
        args.messageHash,
      );
      return MessageSchema.parse(message);
    }
    const message = await this.safeQueueService.getMessageByHash(args);
    const parsed = SafeQueueMessageSchema.parse(message);
    return mapSafeQueueMessageToMessage(parsed);
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>> {
    if (!this.safeQueueEnabled) {
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
    const page = await this.safeQueueService.getMessagesBySafe(args);
    const parsed = SafeQueueMessagePageSchema.parse(page);
    const results = parsed.results.map(mapSafeQueueMessageToMessage);
    return { ...parsed, results };
  }

  async createMessage(args: {
    chainId: string;
    safeAddress: Address;
    message: string | TypedData;
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
    let result: unknown;
    if (!this.safeQueueEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      result = await transactionService.postMessage({
        safeAddress: args.safeAddress,
        message: args.message,
        safeAppId: null,
        signature: args.signature,
        origin: args.origin,
      });
    } else {
      result = await this.safeQueueService.postMessage(args);
    }
    await this.clearMessagesBySafe({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    return result;
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
    let result: unknown;
    if (!this.safeQueueEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      result = await transactionService.postMessageSignature({
        messageHash: args.messageHash,
        signature: args.signature,
      });
    } else {
      result = await this.safeQueueService.postMessageSignature(args);
    }
    await this.clearMessagesByHash({
      chainId: args.chainId,
      messageHash: args.messageHash,
    });
    await this.clearMessagesBySafe({
      chainId: args.chainId,
      safeAddress: message.safe,
    });
    return result;
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    await clearBothCacheLayers(
      this.loggingService,
      transactionService.clearMessagesBySafe(args),
      this.safeQueueService.clearMessagesBySafe(args),
      `messages cache. chainId=${args.chainId}, safeAddress=${args.safeAddress}`,
    );
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    await clearBothCacheLayers(
      this.loggingService,
      transactionService.clearMessagesByHash(args),
      this.safeQueueService.clearMessagesByHash(args),
      `message cache. chainId=${args.chainId}, messageHash=${args.messageHash}`,
    );
  }
}
