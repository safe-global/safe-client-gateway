import type { Page } from '@/domain/entities/page.entity';
import type { Campaign } from '@/domain/community/entities/campaign.entity';
import type { CampaignActivity } from '@/domain/community/entities/campaign-activity.entity';
import type { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import type { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import type { LockingRank } from '@/domain/community/entities/locking-rank.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const ILockingApi = Symbol('ILockingApi');

export interface ILockingApi {
  getCampaignById(resourceId: string): Promise<Raw<Campaign>>;

  getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Campaign>>>;

  getCampaignActivities(args: {
    resourceId: string;
    holder?: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<CampaignActivity>>>;

  getLockingRank(safeAddress: `0x${string}`): Promise<Raw<LockingRank>>;

  getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<LockingRank>>>;

  getCampaignLeaderboard(args: {
    resourceId: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<CampaignRank>>>;

  getCampaignRank(args: {
    resourceId: string;
    safeAddress: `0x${string}`;
  }): Promise<Raw<CampaignRank>>;

  getLockingHistory(args: {
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<LockingEvent>>>;
}
