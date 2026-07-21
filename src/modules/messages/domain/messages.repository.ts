// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Address, Hash, Hex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
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
import {
  QueueMessagePageSchema,
  QueueMessageSchema,
} from '@/modules/queue/entities/message.entity';
import { mapQueueMessageToMessage } from '@/modules/queue/mappers/message.mapper';
import { IQueueService } from '@/modules/queue/queue.interface';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  private readonly queueServiceEnabled: boolean;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IQueueService)
    private readonly queueService: IQueueService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
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
    const parsed = QueueMessageSchema.parse(message);
    if (parsed.chainId !== Number(args.chainId)) {
      this.loggingService.warn(
        `Queue service returned message for chainId=${parsed.chainId}, expected=${args.chainId}, messageHash=${args.messageHash}`,
      );
      throw new HttpExceptionNoLog('Message not found', HttpStatus.NOT_FOUND);
    }
    return mapQueueMessageToMessage(parsed);
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
    const expectedChainId = Number(args.chainId);
    const results: Array<Message> = [];
    for (const message of parsed.results) {
      if (message.chainId !== expectedChainId) {
        this.loggingService.warn(
          `Queue service returned message for chainId=${message.chainId}, expected=${expectedChainId}, messageHash=${message.messageHash}`,
        );
        continue;
      }
      results.push(mapQueueMessageToMessage(message));
    }
    // Best-effort: keep `count` consistent with what we actually return on
    // this page when wrong-chain messages are filtered out. This only corrects
    // for rows filtered on the current page — if `count` is a total across all
    // pages and earlier pages also dropped rows, it can still over-report. The
    // queue is queried with the chain id, so cross-chain results should be rare
    // to begin with.
    const filteredOut = parsed.results.length - results.length;
    const count =
      parsed.count === null ? null : Math.max(0, parsed.count - filteredOut);
    return { ...parsed, count, results };
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
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      return transactionService.postMessage({
        safeAddress: args.safeAddress,
        message: args.message,
        safeAppId: null,
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
