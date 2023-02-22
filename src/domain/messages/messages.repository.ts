import { Inject, Injectable } from '@nestjs/common';
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
}
