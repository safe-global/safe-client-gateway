import { Page } from '@/domain/entities/page.entity';
import { Message } from '@/domain/messages/entities/message.entity';
import { Module } from '@nestjs/common';
import { MessagesRepository } from '@/domain/messages/messages.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

export const IMessagesRepository = Symbol('IMessagesRepository');

export interface IMessagesRepository {
  getMessageByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<Message>;

  getMessagesBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>>;

  createMessage(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    message: unknown;
    safeAppId: number;
    signature: string;
  }): Promise<unknown>;

  updateMessageSignature(args: {
    chainId: string;
    messageHash: string;
    signature: string;
  }): Promise<unknown>;

  clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void>;
}

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IMessagesRepository,
      useClass: MessagesRepository,
    },
  ],
  exports: [IMessagesRepository],
})
export class MessagesRepositoryModule {}
