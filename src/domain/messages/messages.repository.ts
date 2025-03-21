import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Message } from '@/domain/messages/entities/message.entity';
import { IMessagesRepository } from '@/domain/messages/messages.repository.interface';
import {
  MessagePageSchema,
  MessageSchema,
} from '@/domain/messages/entities/message.entity';
import { MessageVerifierHelper } from '@/domain/messages/helpers/message-verifier.helper';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { TypedData } from '@/domain/messages/entities/typed-data.entity';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly messageVerifier: MessageVerifierHelper,
  ) {}

  async getMessageByHash(args: {
    chainId: string;
    messageHash: `0x${string}`;
  }): Promise<Message> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const message = await transactionService.getMessageByHash(args.messageHash);
    return MessageSchema.parse(message);
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Message>> {
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

  async createMessage(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    message: string | TypedData;
    safeAppId: number | null;
    signature: `0x${string}`;
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

  async updateMessageSignature(args: {
    chainId: string;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
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
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.postMessageSignature({
      messageHash: args.messageHash,
      signature: args.signature,
    });
  }

  async clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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
}
