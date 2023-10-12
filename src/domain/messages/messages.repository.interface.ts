import { Page } from '@/domain/entities/page.entity';
import { Message } from '@/domain/messages/entities/message.entity';

export const IMessagesRepository = Symbol('IMessagesRepository');

export interface IMessagesRepository {
  getMessageByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<Message>;

  getMessagesBySafe(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>>;

  createMessage(args: {
    chainId: string;
    safeAddress: string;
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
    safeAddress: string;
  }): Promise<void>;

  clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void>;
}
