// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@/domain/entities/page.entity';
import { Message } from '@/modules/messages/domain/entities/message.entity';
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
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IQueue)
    private readonly queueService: IQueue,
    private readonly messageVerifier: MessageVerifierHelper,
  ) {}

  async getMessageByHash(args: {
    chainId: string;
    messageHash: Hash;
  }): Promise<Message> {
    const message = await this.queueService.getMessageByHash({
      chainId: args.chainId,
      messageHash: args.messageHash,
    });
    const parsed = QueueMessageSchema.parse(message);
    return mapQueueToMessage(parsed);
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Message>> {
    const page = await this.queueService.getMessagesBySafe({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      limit: args.limit,
      offset: args.offset,
    });
    const queueMessages = QueueMessagePageSchema.parse(page);

    return {
      ...queueMessages,
      results: queueMessages.results.map(mapQueueToMessage),
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
    return this.queueService.postMessage({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      message: args.message,
      safeAppId: args.safeAppId,
      signature: args.signature,
      origin: args.origin,
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
    return this.queueService.postMessageSignature({
      chainId: args.chainId,
      messageHash: args.messageHash,
      signature: args.signature,
    });
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    await this.queueService.clearMessagesBySafe(args);
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    await this.queueService.clearMessagesByHash(args);
  }
}
