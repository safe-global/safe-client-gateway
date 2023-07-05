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

    return this.messageValidator.validatePage(page);
  }

  async createMessage(
    chainId: string,
    safeAddress: string,
    message: unknown,
    safeAppId: number | null,
    signature: string,
  ): Promise<unknown> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);

    return transactionService.postMessage(
      safeAddress,
      message,
      safeAppId,
      signature,
    );
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
