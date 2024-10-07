import type { Page } from '@/domain/entities/page.entity';
import type { Campaign } from '@/domain/community/entities/campaign.entity';
import type { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import type { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import type { LockingRank } from '@/domain/community/entities/locking-rank.entity';

export const ILockingApi = Symbol('ILockingApi');

export interface ILockingApi {
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
  }): Promise<number>;

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
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingEvent>>;
}
