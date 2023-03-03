import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../entities/page.entity';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { Message } from './entities/message.entity';
import { MessageValidator } from './message.validator';
import { IMessagesRepository } from './messages.repository.interface';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly messageValidator: MessageValidator,
  ) {}

  async getMessageByHash(
    chainId: string,
    messageHash: string,
  ): Promise<Message> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const message = await transactionService.getMessageByHash(messageHash);
    return this.messageValidator.validate(message);
  }

  async getMessagesBySafe(
    chainId: string,
    safeAddress: string,
    limit?: number | undefined,
    offset?: number | undefined,
  ): Promise<Page<Message>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page = await transactionService.getMessagesBySafe(
      safeAddress,
      limit,
      offset,
    );
    page.results.map((message) => this.messageValidator.validate(message));
    return page;
  }

  async createMessage(
    chainId: string,
    safeAddress: string,
    message: unknown,
    safeAppId: number | null,
    signature: string,
  ): Promise<Message> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const createdMessage = await transactionService.postMessage(
      safeAddress,
      message,
      safeAppId,
      signature,
    );
    return this.messageValidator.validate(createdMessage);
  }

  async updateMessageSignature(
    chainId: string,
    messageHash: string,
    signature: string,
  ): Promise<unknown> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);

    return transactionService.postMessageSignature(messageHash, signature);
  }
}
