// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@/domain/entities/page.entity';
import { Message } from '@/modules/messages/domain/entities/message.entity';
import { IMessagesRepository } from '@/modules/messages/domain/messages.repository.interface';
import {
  MessagePageSchema,
  MessageSchema,
} from '@/modules/messages/domain/entities/message.entity';
import { MessageVerifierHelper } from '@/modules/messages/domain/helpers/message-verifier.helper';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { TypedData } from '@/modules/messages/domain/entities/typed-data.entity';
import { IOffchain } from '@/modules/offchain/offchain.interface';
import type { Address, Hash, Hex } from 'viem';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IOffchain)
    private readonly offchainService: IOffchain,
    private readonly messageVerifier: MessageVerifierHelper,
  ) {}

  async getMessageByHash(args: {
    chainId: string;
    messageHash: Hash;
  }): Promise<Message> {
    const message = await this.offchainService.getMessageByHash({
      chainId: args.chainId,
      messageHash: args.messageHash,
    });
    return MessageSchema.parse(message);
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Message>> {
    const page = await this.offchainService.getMessagesBySafe({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      limit: args.limit,
      offset: args.offset,
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
    return this.offchainService.postMessage({
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
    return this.offchainService.postMessageSignature({
      chainId: args.chainId,
      messageHash: args.messageHash,
      signature: args.signature,
    });
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    await this.offchainService.clearMessagesBySafe(args);
  }

  async clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void> {
    await this.offchainService.clearMessagesByHash(args);
  }
}
