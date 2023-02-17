import { Inject, Injectable } from '@nestjs/common';
import { MessagesRepository } from '../../domain/messages/messages.repository';
import { IMessagesRepository } from '../../domain/messages/messages.repository.interface';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Message } from './entities/message.entity';
import { MessageMapper } from './mappers/message-mapper';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(IMessagesRepository)
    private readonly messagesRepository: MessagesRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
    private readonly messageMapper: MessageMapper,
  ) {}

  async getMessageByHash(
    chainId: string,
    messageHash: string,
  ): Promise<Message> {
    const message = await this.messagesRepository.getMessageByHash(
      chainId,
      messageHash,
    );
    const safe = await this.safeRepository.getSafe(chainId, message.safe);
    return this.messageMapper.mapMessage(chainId, message, safe);
  }
}
