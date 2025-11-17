import type { Page } from '@/domain/entities/page.entity';
import type { Campaign } from '@/modules/community/domain/entities/campaign.entity';
import type { CampaignRank } from '@/modules/community/domain/entities/campaign-rank.entity';
import type { LockingEvent } from '@/modules/community/domain/entities/locking-event.entity';
import type { LockingRank } from '@/modules/community/domain/entities/locking-rank.entity';
import type { CampaignActivity } from '@/modules/community/domain/entities/campaign-activity.entity';
import type { EligibilityRequest } from '@/modules/community/domain/entities/eligibility-request.entity';
import type { Eligibility } from '@/modules/community/domain/entities/eligibility.entity';
import type { Address } from 'viem';

export const ICommunityRepository = Symbol('ICommunityRepository');

export interface ICommunityRepository {
  getCampaignById(resourceId: string): Promise<Campaign>;

  getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Campaign>>;

  getCampaignActivities(args: {
    resourceId: string;
    holder?: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<CampaignActivity>>;

  getLockingRank(safeAddress: Address): Promise<LockingRank>;

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
    safeAddress: Address;
  }): Promise<CampaignRank>;

  getLockingHistory(args: {
    safeAddress: Address;
    offset?: number;
    limit?: number;
  }): Promise<Page<LockingEvent>>;

  checkEligibility(
    eligibilityRequest: EligibilityRequest,
  ): Promise<Eligibility>;
}
