import type { Page } from '@/domain/entities/page.entity';
import type { Campaign } from '@/domain/community/entities/campaign.entity';
import type { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import type { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import type { LockingRank } from '@/domain/community/entities/locking-rank.entity';
import type { CampaignActivity } from '@/domain/community/entities/campaign-activity.entity';
import type { EligibilityRequest } from '@/domain/community/entities/eligibility-request.entity';
import type { Eligibility } from '@/domain/community/entities/eligibility.entity';

export const ICommunityRepository = Symbol('ICommunityRepository');

export interface ICommunityRepository {
  getCampaignById(resourceId: string): Promise<Campaign>;

  getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Campaign>>;

  getCampaignActivities(args: {
    resourceId: string;
    holder?: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<CampaignActivity>>;

  getLockingRank(safeAddress: `0x${string}`): Promise<LockingRank>;

  getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingRank>>;

  getCampaignLeaderboard(args: {
    resourceId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<CampaignRank>>;

  getCampaignRank(args: {
    resourceId: string;
    safeAddress: `0x${string}`;
  }): Promise<CampaignRank>;

  getLockingHistory(args: {
    safeAddress: `0x${string}`;
    offset?: number;
    limit?: number;
  }): Promise<Page<LockingEvent>>;

  checkEligibility(
    eligibilityRequest: EligibilityRequest,
  ): Promise<Eligibility>;
}
