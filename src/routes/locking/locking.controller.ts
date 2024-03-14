import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { LockingService } from '@/routes/locking/locking.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

@ApiTags('locking')
@Controller({
  path: 'locking',
  version: '1',
})
export class LockingController {
  constructor(private readonly lockingService: LockingService) {}

  @Get('/leaderboard/:safeAddress')
  async getRank(
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: z.infer<typeof AddressSchema>,
  ): Promise<Rank> {
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
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: z.infer<typeof AddressSchema>,
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
