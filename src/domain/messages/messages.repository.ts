import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Message } from '@/domain/messages/entities/message.entity';
import { IMessagesRepository } from '@/domain/messages/messages.repository.interface';
import {
  MessagePageSchema,
  MessageSchema,
} from '@/domain/messages/entities/message.entity';
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import { TypedData } from '@/domain/messages/entities/typed-data.entity';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly transactionVerifier: TransactionVerifierHelper,
  ) {}

  async getMessageByHash(args: {
    chainId: string;
    messageHash: `0x${string}`;
  }): Promise<Message> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const message = await transactionService
      .getMessageByHash(args.messageHash)
      .then(MessageSchema.parse);

    // TODO: Add tests
    await this.transactionVerifier.verifyMessage({
      ...args,
      address: message.safe,
      message: message.message,
      messageHash: message.messageHash,
      // TODO: Is there a prepared signature when awaiting confirmations
      signature: message.preparedSignature,
    });

    return message;
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
    const page = await transactionService
      .getMessagesBySafe({
        safeAddress: args.safeAddress,
        limit: args.limit,
        offset: args.offset,
      })
      .then(MessagePageSchema.parse);

    // TODO: Add tests
    for (const message of page.results) {
      await this.transactionVerifier.verifyMessage({
        ...args,
        address: message.safe,
        message: message.message,
        messageHash: message.messageHash,
        // TODO: Is there a prepared signature when awaiting confirmations
        signature: message.preparedSignature,
      });
    }

    return page;
  }

  async createMessage(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    message: string | TypedData;
    safeAppId: number | null;
    signature: `0x${string}`;
    origin: string | null;
  }): Promise<unknown> {
    await this.transactionVerifier.verifyMessage({
      ...args,
      address: args.safeAddress,
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
    await this.transactionVerifier.verifyMessage({
      ...args,
      address: message.safe,
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
