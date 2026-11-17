// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import maxBy from 'lodash/maxBy';
import type { Address, Hash, Hex } from 'viem';
import { SAFE_QUEUE_SERVICE_MAX_LIMIT } from '#/domain/common/constants';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { Page } from '#/domain/entities/page.entity';
import { ILoggingService, LoggingService } from '#/logging/logging.interface';
import type { Message } from '#/modules/messages/domain/entities/message.entity';
import { TypedData } from '#/modules/messages/domain/entities/typed-data.entity';
import { MessageVerifierHelper } from '#/modules/messages/domain/helpers/message-verifier.helper';
import { IMessagesRepository } from '#/modules/messages/domain/messages.repository.interface';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import {
  SafeQueueMessagePageSchema,
  SafeQueueMessageSchema,
} from '#/modules/safe-queue/entities/message.entity';
import { mapSafeQueueMessageToMessage } from '#/modules/safe-queue/mappers/message.mapper';
import { ISafeQueueService } from '#/modules/safe-queue/safe-queue.interface';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(ISafeQueueService)
    private readonly safeQueueService: ISafeQueueService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly messageVerifier: MessageVerifierHelper,
  ) {}

  async getMessageByHash(args: {
    chainId: string;
    messageHash: Hash;
  }): Promise<Message> {
    const message = await this.safeQueueService.getMessageByHash(args);
    const parsed = SafeQueueMessageSchema.parse(message);
    if (parsed.chainId !== Number(args.chainId)) {
      this.loggingService.warn(
        `Queue service returned message for chainId=${parsed.chainId}, expected=${args.chainId}, messageHash=${args.messageHash}`,
      );
      throw new HttpExceptionNoLog('Message not found', HttpStatus.NOT_FOUND);
    }
    return mapSafeQueueMessageToMessage(parsed);
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>> {
    const page = await this.safeQueueService.getMessagesBySafe(args);
    const parsed = SafeQueueMessagePageSchema.parse(page);
    const expectedChainId = Number(args.chainId);
    const results: Array<Message> = [];
    for (const message of parsed.results) {
      if (message.chainId !== expectedChainId) {
        this.loggingService.warn(
          `Queue service returned message for chainId=${message.chainId}, expected=${expectedChainId}, messageHash=${message.messageHash}`,
        );
        continue;
      }
      results.push(mapSafeQueueMessageToMessage(message));
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

  /**
   * The queue service cannot order messages by modification date, so its
   * first page (`SAFE_QUEUE_SERVICE_MAX_LIMIT` messages) is searched for the
   * latest `modified` instead of trusting whatever order it is served in.
   */
  async getLastModifiedMessage(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Message | null> {
    const page = await this.getMessagesBySafe({
      ...args,
      limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
    });
    return maxBy(page.results, (message) => message.modified.getTime()) ?? null;
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
    const result = await this.safeQueueService.postMessage(args);
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
    const result = await this.safeQueueService.postMessageSignature(args);
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

  // Best-effort: a failed clear is logged, not thrown, so it cannot fail a
  // write that already succeeded.
  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    await this.safeQueueService.clearMessagesBySafe(args).catch((error) => {
      this.loggingService.warn(
        `Failed to clear queue messages cache. chainId=${args.chainId}, safeAddress=${args.safeAddress}, error=${error}`,
      );
    });
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    await this.safeQueueService.clearMessagesByHash(args).catch((error) => {
      this.loggingService.warn(
        `Failed to clear queue message cache. chainId=${args.chainId}, messageHash=${args.messageHash}, error=${error}`,
      );
    });
  }
}
