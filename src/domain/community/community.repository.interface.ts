import { Page } from '@/domain/entities/page.entity';
import { Campaign } from '@/domain/community/entities/campaign.entity';
import { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import { Rank } from '@/domain/community/entities/rank.entity';

export const ICommunityRepository = Symbol('ICommunityRepository');

export interface ICommunityRepository {
  getCampaignById(campaignId: string): Promise<Campaign>;

  getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Campaign>>;

  getRank(safeAddress: `0x${string}`): Promise<Rank>;

  getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>>;

  getCampaignLeaderboard(args: {
    campaignId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<CampaignRank>>;

  getLockingHistory(args: {
    safeAddress: `0x${string}`;
    offset?: number;
    limit?: number;
  }): Promise<Page<LockingEvent>>;
}
