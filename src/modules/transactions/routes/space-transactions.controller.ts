// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { SpaceQueuedItemPage } from '#/modules/transactions/routes/entities/space-queued-item-page.entity';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import { Auth } from '#/routes/common/auth/auth.decorator';
import { PaginationDataDecorator } from '#/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '#/routes/common/decorators/route.url.decorator';
import type { PaginationData } from '#/routes/common/pagination/pagination.data';
import { SpaceIdPipe } from '#/routes/common/pipes/space-id.pipe';

@ApiTags('transactions')
@Controller({
  path: 'spaces/:spaceId/transactions',
  version: '1',
})
@UseGuards(AuthGuard)
export class SpaceTransactionsController {
  public constructor(
    private readonly spaceTransactionsService: SpaceTransactionsService,
  ) {}

  @ApiOperation({
    summary: 'Get the transaction queue of a Space',
    description:
      'Retrieves the pending transactions of every Safe in a Space, across chains, ordered by nonce. Results come in runs of one Safe each; a page never ends inside a nonce.',
  })
  @ApiParam({ name: 'spaceId', type: 'string', description: 'Space UUID' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor from the `next` URL of a previous page',
  })
  @ApiOkResponse({
    type: SpaceQueuedItemPage,
    description: 'Paginated queue of the Safes in the Space',
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Not a member of this Space' })
  @ApiNotFoundResponse({ description: 'Space not found' })
  @Get('queued')
  public async getTransactionQueue(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Auth() authPayload: AuthPayload,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<SpaceQueuedItemPage> {
    return await this.spaceTransactionsService.getTransactionQueue({
      spaceId,
      authPayload,
      routeUrl,
      paginationData,
    });
  }
}
