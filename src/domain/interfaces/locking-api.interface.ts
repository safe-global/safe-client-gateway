import type { Page } from '@/domain/entities/page.entity';
import type { Campaign } from '@/modules/community/domain/entities/campaign.entity';
import type { CampaignActivity } from '@/modules/community/domain/entities/campaign-activity.entity';
import type { CampaignRank } from '@/modules/community/domain/entities/campaign-rank.entity';
import type { LockingEvent } from '@/modules/community/domain/entities/locking-event.entity';
import type { LockingRank } from '@/modules/community/domain/entities/locking-rank.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address } from 'viem';

export const ILockingApi = Symbol('ILockingApi');

export interface ILockingApi {
  getCampaignById(resourceId: string): Promise<Raw<Campaign>>;

  getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Campaign>>>;

  getCampaignActivities(args: {
    resourceId: string;
    holder?: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<CampaignActivity>>>;

  getLockingRank(safeAddress: Address): Promise<Raw<LockingRank>>;

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
    safeAddress: Address;
  }): Promise<Raw<CampaignRank>>;

  getLockingHistory(args: {
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<LockingEvent>>>;
}
