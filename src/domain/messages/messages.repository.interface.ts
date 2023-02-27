import { Page } from '../entities/page.entity';
import { Message } from './entities/message.entity';

export const IMessagesRepository = Symbol('IMessagesRepository');

export interface IMessagesRepository {
  getMessageByHash(chainId: string, messageHash: string): Promise<Message>;

  getMessagesBySafe(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Message>>;

  createMessage(
    chainId: string,
    safeAddress: string,
    message: unknown,
    safeAppId: number,
    signature: string,
  ): Promise<Message>;
}
