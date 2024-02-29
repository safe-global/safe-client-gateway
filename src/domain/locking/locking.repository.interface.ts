import { Page } from '@/domain/entities/page.entity';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';

export const ILockingRepository = Symbol('ILockingRepository');

export interface ILockingRepository {
  getRank(safeAddress: string): Promise<Rank>;

  getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>>;

  getLockingHistory(args: {
    safeAddress: string;
    offset?: number;
    limit?: number;
  }): Promise<Page<LockingEvent>>;
}
