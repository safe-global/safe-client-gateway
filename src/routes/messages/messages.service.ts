import { Inject, Injectable } from '@nestjs/common';
import { groupBy, sortBy } from 'lodash';
import { Message as DomainMessage } from '../../domain/messages/entities/message.entity';
import { MessagesRepository } from '../../domain/messages/messages.repository';
import { IMessagesRepository } from '../../domain/messages/messages.repository.interface';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { DateLabel } from '../common/entities/date-label.entity';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { CreateMessageDto } from './entities/create-message.dto.entity';
import { CreatedMessage } from './entities/created-message.entity';
import { MessageItem } from './entities/message-item.entity';
import { Message } from './entities/message.entity';
import { UpdateMessageSignatureDto } from './entities/update-message-signature.entity';
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

  async getMessagesBySafe(
    chainId: string,
    safeAddress: string,
    paginationData: PaginationData,
    routeUrl: Readonly<URL>,
  ): Promise<Page<DateLabel | MessageItem>> {
    const safe = await this.safeRepository.getSafe(chainId, safeAddress);
    const page = await this.messagesRepository.getMessagesBySafe(
      chainId,
      safeAddress,
      paginationData.limit,
      paginationData.offset,
    );
    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, page.next);
    const previousURL = cursorUrlFromLimitAndOffset(routeUrl, page.previous);
    const groups = this.getOrderedGroups(page.results);

    const results: (DateLabel | MessageItem)[] = [];
    await Promise.all(
      groups.map(async ([timestamp, messages]) => {
        const messageItems = await this.messageMapper.mapMessageItems(
          chainId,
          messages,
          safe,
        );
        results.push(new DateLabel(timestamp));
        results.push(...messageItems);
      }),
    );

    return <Page<DateLabel | MessageItem>>{
      count: page.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  /**
   * Groups messages by creation day. For each group, a tuple containing
   * [timestamp, message[]] is returned. Each tuple contains the UTC start
   * of the day the messages were created, and the messages created in
   * that UTC date.
   *
   * Tuples are ordered ascending by timestamp.
   *
   * @param messages messages to group
   * @returns ordered tuples containing [timestamp, message[]]
   */
  private getOrderedGroups(
    messages: DomainMessage[],
  ): [number, DomainMessage[]][] {
    const groups = groupBy(messages, (m) =>
      new Date(
        Date.UTC(
          m.created.getFullYear(),
          m.created.getMonth(),
          m.created.getDate(),
        ),
      ).getTime(),
    );

    return sortBy(Object.entries(groups), ([timestamp]) => timestamp).map(
      ([timestamp, messages]) => [Number(timestamp), messages],
    );
  }

  async createMessage(
    chainId: string,
    safeAddress: string,
    createMessageDto: CreateMessageDto,
  ): Promise<CreatedMessage> {
    return await this.messagesRepository.createMessage(
      chainId,
      safeAddress,
      createMessageDto.message,
      createMessageDto.safeAppId,
      createMessageDto.signature,
    );
  }

  async updateMessageSignature(
    chainId: string,
    messageHash: string,
    updateMessageSignatureDto: UpdateMessageSignatureDto,
  ): Promise<unknown> {
    return await this.messagesRepository.updateMessageSignature(
      chainId,
      messageHash,
      updateMessageSignatureDto.signature,
    );
  }
}
