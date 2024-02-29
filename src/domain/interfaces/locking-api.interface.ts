import { Page } from '@/domain/entities/page.entity';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';

export const ILockingApi = Symbol('ILockingApi');

export interface ILockingApi {
  getLeaderboard(args: {
    safeAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>>;

  getLockingHistory(args: {
    safeAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingEvent>>;
}
