import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { DateLabel } from '../common/entities/date-label.entity';
import { Page } from '../common/entities/page.entity';
import { PaginationData } from '../common/pagination/pagination.data';
import { MessageItem } from './entities/message-item.entity';
import { Message } from './entities/message.entity';
import { MessagePage } from './entities/messages-page.entity';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@Controller({
  path: '',
  version: '1',
})
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @ApiOkResponse({ type: Message })
  @Get('chains/:chainId/messages/:messageHash')
  async getMessageByHash(
    @Param('chainId') chainId: string,
    @Param('messageHash') messageHash: string,
  ): Promise<Message> {
    return this.messagesService.getMessageByHash(chainId, messageHash);
  }

  @ApiOkResponse({ type: MessagePage })
  @Get('chains/:chainId/safes/:safeAddress/messages')
  @ApiQuery({ name: 'cursor', required: false })
  async getMessagesBySafe(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<DateLabel | MessageItem>> {
    return this.messagesService.getMessagesBySafe(
      chainId,
      safeAddress,
      paginationData,
      routeUrl,
    );
  }
}
