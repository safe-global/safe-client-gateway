import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { CommunityService } from '@/routes/community/community.service';
import { CampaignRankPage } from '@/routes/locking/entities/campaign-rank.page.entity';
import { Campaign } from '@/routes/locking/entities/campaign.entity';
import { CampaignPage } from '@/routes/locking/entities/campaign.page.entity';
import { LockingEventPage } from '@/routes/locking/entities/locking-event.page.entity';
import { LockingRank } from '@/routes/locking/entities/locking-rank.entity';
import { LockingRankPage } from '@/routes/locking/entities/locking-rank.page.entity';
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
  @Get('/campaigns/:campaignId')
  async getCampaignById(
    @Param('campaignId') campaignId: string,
  ): Promise<Campaign> {
    return this.communityService.getCampaignById(campaignId);
  }

  @ApiOkResponse({ type: CampaignRankPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('/campaigns/:campaignId/leaderboard')
  async getCampaignLeaderboard(
    @Param('campaignId') campaignId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<CampaignRankPage> {
    return this.communityService.getCampaignLeaderboard({
      campaignId,
      routeUrl,
      paginationData,
    });
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
