import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Message } from './entities/message.entity';
import { MessagesService } from './messages.service';

@ApiTags('estimations')
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
}
