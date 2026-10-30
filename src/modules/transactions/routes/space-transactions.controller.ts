// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import {
  SpaceQueueStatus,
  type SpaceQueueStatuses,
  SpaceQueueStatusesSchema,
} from '#/modules/transactions/routes/entities/schemas/space-queue-filters.schema';
import { SpaceQueuedItemPage } from '#/modules/transactions/routes/entities/space-queued-item-page.entity';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import { Auth } from '#/routes/common/auth/auth.decorator';
import { SpaceIdPipe } from '#/routes/common/pipes/space-id.pipe';
import { BooleanStringSchema } from '#/validation/entities/schemas/boolean-string.schema';
import {
  type Caip10Addresses,
  Caip10AddressesSchema,
} from '#/validation/entities/schemas/caip-10-addresses.schema';
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
      'Retrieves the pending transactions of every Safe in a Space, across chains, in nonce order. Results are keyed by Safe address and then by chain ID. The queue is read up to a maximum number of queue service pages; `count` is the size of the whole queue. The filters narrow `results`; `counts` always covers the whole queue read. A matching transaction is returned with the rest of its conflict group and its label.',
  })
  @ApiParam({ name: 'spaceId', type: 'string', description: 'Space UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    isArray: true,
    enum: Object.values(SpaceQueueStatus),
    description:
      'Keep the transactions with one of these statuses, comma-separated. `sign` is a transaction one of the caller wallets still has to sign.',
    example: 'sign,execute',
  })
  @ApiQuery({
    name: 'safes',
    type: String,
    required: false,
    description:
      'Keep the transactions of these Safes, comma-separated as `{chainId}:{safeAddress}`',
    example: '11155111:0x0000000000000000000000000000000000000000',
  })
  @ApiQuery({
    name: 'conflicting',
    type: Boolean,
    required: false,
    description: 'Keep the transactions sharing their nonce with another',
  })
  @ApiQuery({
    name: 'stale',
    type: Boolean,
    required: false,
    description: 'Keep the transactions proposed more than 7 days ago',
  })
  @ApiOkResponse({
    type: SpaceQueuedItemPage,
    description: 'Queue of the Safes in the Space',
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Not a member of this Space' })
  @ApiNotFoundResponse({ description: 'Space not found' })
  @ApiUnprocessableEntityResponse({
    description: 'Unknown status, invalid CAIP-10 address or non-boolean flag',
  })
  @Get('queued')
  public async getTransactionQueue(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Auth() authPayload: AuthPayload,
    @Query('status', new ValidationPipe(SpaceQueueStatusesSchema.optional()))
    statuses?: SpaceQueueStatuses,
    @Query('safes', new ValidationPipe(Caip10AddressesSchema.optional()))
    safes?: Caip10Addresses,
    @Query('conflicting', new ValidationPipe(BooleanStringSchema.optional()))
    conflicting?: boolean,
    @Query('stale', new ValidationPipe(BooleanStringSchema.optional()))
    stale?: boolean,
  ): Promise<SpaceQueuedItemPage> {
    return await this.spaceTransactionsService.getTransactionQueue({
      spaceId,
      authPayload,
      filters: {
        statuses,
        safes: safes?.map(({ chainId, address }) => ({
          chainId,
          safeAddress: address,
        })),
        conflicting,
        stale,
      },
    });
  }
}
