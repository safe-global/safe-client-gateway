import { Page } from '@/domain/entities/page.entity';
import { Campaign } from '@/domain/community/entities/campaign.entity';
import { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import { LockingRank } from '@/domain/community/entities/locking-rank.entity';
import { CampaignActivity } from '@/domain/community/entities/campaign-activity.entity';

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
}
