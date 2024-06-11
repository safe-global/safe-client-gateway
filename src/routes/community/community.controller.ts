import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { CommunityService } from '@/routes/community/community.service';
import { CampaignPointsPage } from '@/routes/community/entities/campaign-points.page.entity';
import { CampaignRank } from '@/routes/community/entities/campaign-rank.entity';
import { CampaignRankPage } from '@/routes/community/entities/campaign-rank.page.entity';
import { Campaign } from '@/routes/community/entities/campaign.entity';
import { CampaignPage } from '@/routes/community/entities/campaign.page.entity';
import { LockingEventPage } from '@/routes/community/entities/locking-event.page.entity';
import { LockingRank } from '@/routes/community/entities/locking-rank.entity';
import { LockingRankPage } from '@/routes/community/entities/locking-rank.page.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('community')
@Controller({
  path: 'community',
  version: '1',
})
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @ApiOkResponse({ type: CampaignPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('/campaigns')
  async getCampaigns(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<CampaignPage> {
    return this.communityService.getCampaigns({ routeUrl, paginationData });
  }

  @ApiOkResponse({ type: Campaign })
  @Get('/campaigns/:resourceId')
  async getCampaignById(
    @Param('resourceId') resourceId: string,
  ): Promise<Campaign> {
    return this.communityService.getCampaignById(resourceId);
  }

  @Get('/campaigns/:resourceId/points/:safeAddress')
  async getCampaignPointsForAddress(
    @Param('resourceId') resourceId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<CampaignPointsPage> {
    return this.communityService.getCampaignPointsForAddress({
      resourceId,
      safeAddress,
      routeUrl,
      paginationData,
    });
  }

  @ApiOkResponse({ type: CampaignRankPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('/campaigns/:resourceId/leaderboard')
  async getCampaignLeaderboard(
    @Param('resourceId') resourceId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<CampaignRankPage> {
    return this.communityService.getCampaignLeaderboard({
      resourceId,
      routeUrl,
      paginationData,
    });
  }

  @ApiOkResponse({ type: CampaignRank })
  @Get('/campaigns/:resourceId/leaderboard/:safeAddress')
  async getCampaignRank(
    @Param('resourceId') resourceId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<CampaignRank> {
    return this.communityService.getCampaignRank({ resourceId, safeAddress });
  }

  @ApiOkResponse({ type: LockingRankPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('/locking/leaderboard')
  async getLeaderboard(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<LockingRankPage> {
    return this.communityService.getLockingLeaderboard({
      routeUrl,
      paginationData,
    });
  }

  @ApiOkResponse({ type: LockingRank })
  @Get('/locking/:safeAddress/rank')
  async getLockingRank(
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<LockingRank> {
    return this.communityService.getLockingRank(safeAddress);
  }

  @ApiOkResponse({ type: LockingEventPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('/locking/:safeAddress/history')
  async getLockingHistory(
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<LockingEventPage> {
    return this.communityService.getLockingHistory({
      safeAddress,
      routeUrl,
      paginationData,
    });
  }
}
