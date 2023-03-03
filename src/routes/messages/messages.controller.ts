import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { DateLabel } from '../common/entities/date-label.entity';
import { Page } from '../common/entities/page.entity';
import { PaginationData } from '../common/pagination/pagination.data';
import { CreateMessageDto } from './entities/create-message.dto.entity';
import { CreatedMessage } from './entities/created-message.entity';
import { MessageItem } from './entities/message-item.entity';
import { Message } from './entities/message.entity';
import { MessagePage } from './entities/messages-page.entity';
import { UpdateMessageSignatureDto } from './entities/update-message-signature.entity';
import { MessagesService } from './messages.service';
import { CreateMessageDtoValidationPipe } from './pipes/create-message.dto.validation.pipe';
import { UpdateMessageSignatureDtoValidationPipe } from './pipes/update-message-signature.dto.validation.pipe';

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

  @HttpCode(200)
  @ApiOkResponse({ type: CreatedMessage })
  @Post('chains/:chainId/safes/:safeAddress/messages')
  async createMessage(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(CreateMessageDtoValidationPipe) createMessageDto: CreateMessageDto,
  ): Promise<CreatedMessage> {
    return this.messagesService.createMessage(
      chainId,
      safeAddress,
      createMessageDto,
    );
  }

  @HttpCode(200)
  @Post('chains/:chainId/messages/:messageHash/signatures')
  async updateMessageSignature(
    @Param('chainId') chainId: string,
    @Param('messageHash') messageHash: string,
    @Body(UpdateMessageSignatureDtoValidationPipe)
    updateMessageSignatureDto: UpdateMessageSignatureDto,
  ): Promise<unknown> {
    return this.messagesService.updateMessageSignature(
      chainId,
      messageHash,
      updateMessageSignatureDto,
    );
  }
}
