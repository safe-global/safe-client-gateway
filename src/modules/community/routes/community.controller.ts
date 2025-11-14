import { EligibilityRequestSchema } from '@/modules/community/domain/entities/eligibility-request.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { CommunityService } from '@/modules/community/routes/community.service';
import { CampaignActivityPage } from '@/modules/community/routes/entities/campaign-activity.page.entity';
import { CampaignRank } from '@/modules/community/routes/entities/campaign-rank.entity';
import { CampaignRankPage } from '@/modules/community/routes/entities/campaign-rank.page.entity';
import { Campaign } from '@/modules/community/routes/entities/campaign.entity';
import { CampaignPage } from '@/modules/community/routes/entities/campaign.page.entity';
import { EligibilityRequest } from '@/modules/community/routes/entities/eligibility-request.entity';
import { Eligibility } from '@/modules/community/routes/entities/eligibility.entity';
import { LockingEventPage } from '@/modules/community/routes/entities/locking-event.page.entity';
import { LockingRank } from '@/modules/community/routes/entities/locking-rank.entity';
import { LockingRankPage } from '@/modules/community/routes/entities/locking-rank.page.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import type { Address } from 'viem';

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

  @Get('/campaigns/:resourceId/activities')
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'holder', required: false, type: String })
  async getCampaignActivities(
    @Param('resourceId') resourceId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('holder', new ValidationPipe(AddressSchema.optional()))
    holder?: Address,
  ): Promise<CampaignActivityPage> {
    return this.communityService.getCampaignActivities({
      resourceId,
      holder,
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
    safeAddress: Address,
  ): Promise<CampaignRank> {
    return this.communityService.getCampaignRank({ resourceId, safeAddress });
  }

  @ApiOkResponse({ type: Eligibility })
  @HttpCode(200)
  @Post('/eligibility')
  async checkEligibility(
    @Body(new ValidationPipe(EligibilityRequestSchema))
    eligibilityRequest: EligibilityRequest,
  ): Promise<Eligibility> {
    return this.communityService.checkEligibility(eligibilityRequest);
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
    safeAddress: Address,
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
    safeAddress: Address,
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
