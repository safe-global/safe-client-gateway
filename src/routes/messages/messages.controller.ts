import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { DateLabel } from '@/routes/common/entities/date-label.entity';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { CreateMessageDto } from '@/routes/messages/entities/create-message.dto.entity';
import { MessageItem } from '@/routes/messages/entities/message-item.entity';
import { Message } from '@/routes/messages/entities/message.entity';
import { MessagePage } from '@/routes/messages/entities/messages-page.entity';
import { UpdateMessageSignatureDto } from '@/routes/messages/entities/update-message-signature.entity';
import { MessagesService } from '@/routes/messages/messages.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { UpdateMessageSignatureDtoValidationPipe } from '@/routes/messages/pipes/update-message-signature.dto.validation.pipe';
import { CreateMessageDtoSchema } from '@/routes/messages/entities/schemas/create-message.dto.schema';

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
    return this.messagesService.getMessageByHash({ chainId, messageHash });
  }

  @ApiOkResponse({ type: MessagePage })
  @Get('chains/:chainId/safes/:safeAddress/messages')
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async getMessagesBySafe(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<DateLabel | MessageItem>> {
    return this.messagesService.getMessagesBySafe({
      chainId,
      safeAddress,
      paginationData,
      routeUrl,
    });
  }

  @HttpCode(200)
  @Post('chains/:chainId/safes/:safeAddress/messages')
  async createMessage(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(new ValidationPipe(CreateMessageDtoSchema))
    createMessageDto: CreateMessageDto,
  ): Promise<unknown> {
    return this.messagesService.createMessage({
      chainId,
      safeAddress,
      createMessageDto,
    });
  }

  @HttpCode(200)
  @Post('chains/:chainId/messages/:messageHash/signatures')
  async updateMessageSignature(
    @Param('chainId') chainId: string,
    @Param('messageHash') messageHash: string,
    @Body(UpdateMessageSignatureDtoValidationPipe)
    updateMessageSignatureDto: UpdateMessageSignatureDto,
  ): Promise<unknown> {
    return this.messagesService.updateMessageSignature({
      chainId,
      messageHash,
      updateMessageSignatureDto,
    });
  }
}
