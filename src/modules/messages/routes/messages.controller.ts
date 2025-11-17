import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { DateLabel } from '@/routes/common/entities/date-label.entity';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { CreateMessageDto } from '@/modules/messages/routes/entities/create-message.dto.entity';
import { MessageItem } from '@/modules/messages/routes/entities/message-item.entity';
import { Message } from '@/modules/messages/routes/entities/message.entity';
import { MessagePage } from '@/modules/messages/routes/entities/messages-page.entity';
import { UpdateMessageSignatureDto } from '@/modules/messages/routes/entities/update-message-signature.entity';
import { MessagesService } from '@/modules/messages/routes/messages.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { UpdateMessageSignatureDtoSchema } from '@/modules/messages/routes/entities/schemas/update-message-signature.dto.schema';
import { CreateMessageDtoSchema } from '@/modules/messages/routes/entities/schemas/create-message.dto.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address, Hash } from 'viem';

@ApiTags('messages')
@Controller({
  path: '',
  version: '1',
})
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @ApiOperation({
    summary: 'Get message by hash',
    description:
      'Retrieves a specific message by its hash, including signatures, confirmations, and message content.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the message was created',
    example: '1',
  })
  @ApiParam({
    name: 'messageHash',
    type: 'string',
    description: 'Message hash (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: Message,
    description: 'Message retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Message not found',
  })
  @Get('chains/:chainId/messages/:messageHash')
  async getMessageByHash(
    @Param('chainId') chainId: string,
    @Param('messageHash') messageHash: Hash,
  ): Promise<Message> {
    return this.messagesService.getMessageByHash({ chainId, messageHash });
  }

  @ApiOperation({
    summary: 'Get messages for Safe',
    description:
      'Retrieves a paginated list of messages for a specific Safe, including both pending and confirmed messages with date labels.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: MessagePage,
    description: 'Paginated list of messages for the Safe',
  })
  @ApiNotFoundResponse({
    description: 'Safe not found on the specified chain',
  })
  @Get('chains/:chainId/safes/:safeAddress/messages')
  async getMessagesBySafe(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
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

  @ApiOperation({
    summary: 'Create message',
    description:
      'Creates a new message for a Safe. The message must be properly formatted and signed according to EIP-191 or EIP-712 standards.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiBody({
    type: CreateMessageDto,
    description: 'Message data including content and signature',
  })
  @ApiOkResponse({
    description: 'Message created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid message format or signature',
  })
  @HttpCode(200)
  @Post('chains/:chainId/safes/:safeAddress/messages')
  async createMessage(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(CreateMessageDtoSchema))
    createMessageDto: CreateMessageDto,
  ): Promise<unknown> {
    return this.messagesService.createMessage({
      chainId,
      safeAddress,
      createMessageDto,
    });
  }

  @ApiOperation({
    summary: 'Add message signature',
    description:
      'Adds a signature to an existing message. Multiple Safe owners can sign the same message to reach consensus.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the message was created',
    example: '1',
  })
  @ApiParam({
    name: 'messageHash',
    type: 'string',
    description: 'Message hash (0x prefixed hex string)',
  })
  @ApiBody({
    type: UpdateMessageSignatureDto,
    description: 'Signature data to add to the message',
  })
  @ApiOkResponse({
    description: 'Signature added successfully',
  })
  @ApiNotFoundResponse({
    description: 'Message not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid signature or signer not authorized',
  })
  @HttpCode(200)
  @Post('chains/:chainId/messages/:messageHash/signatures')
  async updateMessageSignature(
    @Param('chainId') chainId: string,
    @Param('messageHash') messageHash: Hash,
    @Body(new ValidationPipe(UpdateMessageSignatureDtoSchema))
    updateMessageSignatureDto: UpdateMessageSignatureDto,
  ): Promise<unknown> {
    return this.messagesService.updateMessageSignature({
      chainId,
      messageHash,
      updateMessageSignatureDto,
    });
  }
}
