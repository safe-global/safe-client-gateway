// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { SpaceQueuedItemPage } from '#/modules/transactions/routes/entities/space-queued-item-page.entity';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import { Auth } from '#/routes/common/auth/auth.decorator';
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
      'Retrieves the pending transactions of every Safe in a Space, across chains, in nonce order. Results are keyed by Safe address and then by chain ID. The queue is read up to a maximum number of queue service pages; `count` is the size of the whole queue.',
  })
  @ApiParam({ name: 'spaceId', type: 'string', description: 'Space UUID' })
  @ApiOkResponse({
    type: SpaceQueuedItemPage,
    description: 'Queue of the Safes in the Space',
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Not a member of this Space' })
  @ApiNotFoundResponse({ description: 'Space not found' })
  @Get('queued')
  public async getTransactionQueue(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Auth() authPayload: AuthPayload,
  ): Promise<SpaceQueuedItemPage> {
    return await this.spaceTransactionsService.getTransactionQueue({
      spaceId,
      authPayload,
    });
  }
}
