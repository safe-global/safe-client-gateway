import { Page } from '@/domain/entities/page.entity';
import { Campaign } from '@/domain/community/entities/campaign.entity';
import { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import { LockingRank } from '@/domain/community/entities/locking-rank.entity';

export const ILockingApi = Symbol('ILockingApi');

export interface ILockingApi {
  getCampaignById(campaignId: string): Promise<Campaign>;

  getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Campaign>>;

  getLockingRank(safeAddress: `0x${string}`): Promise<LockingRank>;

  getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingRank>>;

  getCampaignLeaderboard(args: {
    campaignId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<CampaignRank>>;

  getLockingHistory(args: {
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingEvent>>;
}
