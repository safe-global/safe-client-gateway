// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ProposeTransactionDto } from '#/modules/transactions/routes/entities/propose-transaction.dto.entity';
import type { QueuedItem } from '#/modules/transactions/routes/entities/queued-item.entity';
import { QueuedItemPage } from '#/modules/transactions/routes/entities/queued-item-page.entity';
import { ProposeTransactionDtoSchema } from '#/modules/transactions/routes/entities/schemas/propose-transaction.dto.schema';
import { TransactionDetails } from '#/modules/transactions/routes/entities/transaction-details/transaction-details.entity';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import { Auth } from '#/routes/common/auth/auth.decorator';
import { PaginationDataDecorator } from '#/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '#/routes/common/decorators/route.url.decorator';
import type { Page } from '#/routes/common/entities/page.entity';
import type { PaginationData } from '#/routes/common/pagination/pagination.data';
import { SpaceIdPipe } from '#/routes/common/pipes/space-id.pipe';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

@ApiTags('transactions')
@Controller({
  path: 'spaces/:spaceId/chains/:chainId',
  version: '1',
})
@UseGuards(AuthGuard)
export class SpaceTransactionsController {
  public constructor(
    private readonly spaceTransactionsService: SpaceTransactionsService,
  ) {}

  @ApiOperation({
    summary: 'Get transaction queue of a Workspace Safe',
    description:
      'Retrieves the queued transactions of a Safe registered to the Workspace, including the transactions only the Workspace can see.',
  })
  @ApiParam({ name: 'spaceId', type: 'string', description: 'Space UUID' })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address, must be registered to the Space',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: QueuedItemPage,
    description: 'Paginated list of queued transactions',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Not a member of this Space, or the Safe is not registered to it',
  })
  @Get('safes/:safeAddress/transactions/queued')
  public getTransactionQueue(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Auth() authPayload: AuthPayload,
  ): Promise<Page<QueuedItem>> {
    return this.spaceTransactionsService.getTransactionQueue({
      spaceId,
      chainId,
      routeUrl,
      safeAddress,
      paginationData,
      authPayload,
    });
  }

  @ApiOperation({
    summary: 'Propose a transaction only the Workspace can see',
    description:
      'Proposes a transaction for a Safe registered to the Workspace. Only members of the Workspace can see it in the queue.',
  })
  @ApiParam({ name: 'spaceId', type: 'string', description: 'Space UUID' })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address, must be registered to the Space',
  })
  @ApiBody({
    type: ProposeTransactionDto,
    description:
      'Transaction proposal including recipient, value, data, and initial signature',
  })
  @ApiOkResponse({
    type: TransactionDetails,
    description: 'Transaction proposed successfully',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Not a member of this Space, or the Safe is not registered to it',
  })
  @HttpCode(HttpStatus.OK)
  @Post('transactions/:safeAddress/propose')
  public proposeTransaction(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(ProposeTransactionDtoSchema))
    proposeTransactionDto: ProposeTransactionDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<TransactionDetails> {
    return this.spaceTransactionsService.proposeTransaction({
      spaceId,
      chainId,
      safeAddress,
      proposeTransactionDto,
      authPayload,
    });
  }
}
