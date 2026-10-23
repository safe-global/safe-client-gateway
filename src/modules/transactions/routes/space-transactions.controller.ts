// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import {
  type SpaceQueueLimits,
  SpaceQueueLimitsSchema,
} from '#/modules/transactions/routes/entities/space-queue-limits.dto.entity';
import { SpaceTransactionQueue } from '#/modules/transactions/routes/entities/space-transaction-queue.entity';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import { Auth } from '#/routes/common/auth/auth.decorator';
import { RouteUrlDecorator } from '#/routes/common/decorators/route.url.decorator';
import { SpaceIdPipe } from '#/routes/common/pipes/space-id.pipe';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

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
      "Retrieves the first pending transactions of each Safe in a Space, one entry per Safe address across its chains. A Safe's `next` URL is this request with that Safe's limit raised by one page.",
  })
  @ApiParam({ name: 'spaceId', type: 'string', description: 'Space UUID' })
  @ApiQuery({
    name: 'limits',
    required: false,
    type: String,
    description:
      'Comma-separated `address:count` pairs: how many pending transactions to return for each listed Safe. Unlisted Safes return one page.',
  })
  @ApiOkResponse({
    type: SpaceTransactionQueue,
    description: 'The first pending transactions of each Safe in the Space',
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Not a member of this Space' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid limits' })
  @Get('queued')
  public async getTransactionQueue(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Auth() authPayload: AuthPayload,
    @RouteUrlDecorator() routeUrl: URL,
    @Query('limits', new ValidationPipe(SpaceQueueLimitsSchema))
    limits: SpaceQueueLimits,
  ): Promise<SpaceTransactionQueue> {
    return await this.spaceTransactionsService.getTransactionQueue({
      spaceId,
      authPayload,
      routeUrl,
      limits,
    });
  }
}
