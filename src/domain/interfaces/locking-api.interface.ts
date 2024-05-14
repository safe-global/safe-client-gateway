import { Page } from '@/domain/entities/page.entity';
import { Campaign } from '@/domain/locking/entities/campaign.entity';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';

export const ILockingApi = Symbol('ILockingApi');

export interface ILockingApi {
  getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Campaign>>;

  getRank(safeAddress: `0x${string}`): Promise<Rank>;

  getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>>;

  getLockingHistory(args: {
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingEvent>>;
}
