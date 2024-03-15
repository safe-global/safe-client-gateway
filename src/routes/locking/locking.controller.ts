import { LockingEventPage } from '@/routes/locking/entities/locking-event.page.entity';
import { Rank } from '@/routes/locking/entities/rank.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { RankPage } from '@/routes/locking/entities/rank.page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { LockingService } from '@/routes/locking/locking.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

@ApiTags('locking')
@Controller({
  path: 'locking',
  version: '1',
})
export class LockingController {
  constructor(private readonly lockingService: LockingService) {}

  @ApiOkResponse({ type: Rank })
  @Get('/leaderboard/:safeAddress')
  async getRank(
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: z.infer<typeof AddressSchema>,
  ): Promise<Rank> {
    return this.lockingService.getRank(safeAddress);
  }

  @ApiOkResponse({ type: RankPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('/leaderboard')
  async getLeaderboard(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<RankPage> {
    return this.lockingService.getLeaderboard({ routeUrl, paginationData });
  }

  @ApiOkResponse({ type: LockingEventPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('/:safeAddress/history')
  async getLockingHistory(
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: z.infer<typeof AddressSchema>,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<LockingEventPage> {
    return this.lockingService.getLockingHistory({
      safeAddress,
      routeUrl,
      paginationData,
    });
  }
}
