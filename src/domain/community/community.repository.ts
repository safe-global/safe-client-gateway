import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import {
  Campaign,
  CampaignPageSchema,
  CampaignSchema,
} from '@/domain/community/entities/campaign.entity';
import {
  CampaignRank,
  CampaignRankPageSchema,
  CampaignRankSchema,
} from '@/domain/community/entities/campaign-rank.entity';
import { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import { LockingRank } from '@/domain/community/entities/locking-rank.entity';
import { LockingEventPageSchema } from '@/domain/community/entities/schemas/locking-event.schema';
import {
  LockingRankPageSchema,
  LockingRankSchema,
} from '@/domain/community/entities/schemas/locking-rank.schema';
import { ICommunityRepository } from '@/domain/community/community.repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  CampaignActivity,
  CampaignActivityPageSchema,
} from '@/domain/community/entities/campaign-activity.entity';
import { EligibilityRequest } from '@/domain/community/entities/eligibility-request.entity';
import { Eligibility } from '@/domain/community/entities/eligibility.entity';
import { asError } from '@/logging/utils';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { IIdentityApi } from '@/domain/interfaces/identity-api.interface';

@Injectable()
export class CommunityRepository implements ICommunityRepository {
  constructor(
    @Inject(ILockingApi)
    private readonly lockingApi: ILockingApi,
    @Inject(IIdentityApi)
    private readonly identityApi: IIdentityApi,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async getCampaignById(resourceId: string): Promise<Campaign> {
    const campaign = await this.lockingApi.getCampaignById(resourceId);
    return CampaignSchema.parse(campaign);
  }

  async getCampaigns(args: {
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Campaign>> {
    const page = await this.lockingApi.getCampaigns(args);
    return CampaignPageSchema.parse(page);
  }

  async getCampaignActivities(args: {
    resourceId: string;
    holder?: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<CampaignActivity>> {
    const page = await this.lockingApi.getCampaignActivities(args);
    return CampaignActivityPageSchema.parse(page);
  }

  async getLockingRank(safeAddress: `0x${string}`): Promise<LockingRank> {
    const lockingRank = await this.lockingApi.getLockingRank(safeAddress);
    return LockingRankSchema.parse(lockingRank);
  }

  async getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingRank>> {
    const page = await this.lockingApi.getLeaderboard(args);
    return LockingRankPageSchema.parse(page);
  }

  async getCampaignLeaderboard(args: {
    resourceId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<CampaignRank>> {
    const page = await this.lockingApi.getCampaignLeaderboard(args);
    return CampaignRankPageSchema.parse(page);
  }

  async getCampaignRank(args: {
    resourceId: string;
    safeAddress: `0x${string}`;
  }): Promise<CampaignRank> {
    const campaignRank = await this.lockingApi.getCampaignRank(args);
    return CampaignRankSchema.parse(campaignRank);
  }

  async getLockingHistory(args: {
    safeAddress: `0x${string}`;
    offset?: number;
    limit?: number;
  }): Promise<Page<LockingEvent>> {
    const page = await this.lockingApi.getLockingHistory(args);
    return LockingEventPageSchema.parse(page);
  }

  async checkEligibility(
    eligibilityRequest: EligibilityRequest,
  ): Promise<Eligibility> {
    try {
      return await this.identityApi.checkEligibility(eligibilityRequest);
    } catch (err) {
      this.loggingService.error(`Error checking eligibility: ${asError(err)}`);
      return {
        requestId: eligibilityRequest.requestId,
        isAllowed: false,
        isVpn: false,
      };
    }
  }
}
