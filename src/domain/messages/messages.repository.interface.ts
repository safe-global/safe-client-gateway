import { Message } from './entities/message.entity';

export const IMessagesRepository = Symbol('IMessagesRepository');

export interface IMessagesRepository {
  getMessageByHash(chainId: string, messageHash: string): Promise<Message>;
}
