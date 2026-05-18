// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceTransactionsService } from '@/modules/spaces/routes/space-transactions.service';
import type { QueuedItem } from '@/modules/transactions/routes/entities/queued-item.entity';
import { QueuedItemPage } from '@/modules/transactions/routes/entities/queued-item-page.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import type { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/transactions',
  version: '1',
})
export class SpaceTransactionsController {
  public constructor(
    @Inject(SpaceTransactionsService)
    private readonly spaceTransactionsService: SpaceTransactionsService,
  ) {}

  @ApiOperation({
    summary: 'Get space transaction queue',
    description:
      'Retrieves a paginated list of queued (pending) transactions across all Safes in a space, ordered by nonce ascending (oldest first).',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to fetch queued transactions for',
    example: 1,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: QueuedItemPage,
    description: 'Paginated list of queued transactions for the space',
  })
  @ApiNotFoundResponse({
    description: 'Space not found',
  })
  @Get('queued')
  public getTransactionQueue(
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: Space['id'],
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Partial<Page<QueuedItem>>> {
    return this.spaceTransactionsService.getTransactionQueue({
      spaceId,
      routeUrl,
      paginationData,
    });
  }
}
