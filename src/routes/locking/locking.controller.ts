import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { LockingService } from '@/routes/locking/locking.service';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('locking')
@Controller({
  path: 'locking',
  version: '1',
})
export class LockingController {
  constructor(private readonly lockingService: LockingService) {}

  @Get('/:safeAddress/rank')
  async getRank(@Param('safeAddress') safeAddress: string): Promise<Rank> {
    return this.lockingService.getRank(safeAddress);
  }

  @Get('/leaderboard')
  async getLeaderboard(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Rank>> {
    return this.lockingService.getLeaderboard({ routeUrl, paginationData });
  }

  @Get('/:safeAddress/history')
  async getLockingHistory(
    @Param('safeAddress') safeAddress: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<LockingEvent>> {
    return this.lockingService.getLockingHistory({
      safeAddress,
      routeUrl,
      paginationData,
    });
  }
}
