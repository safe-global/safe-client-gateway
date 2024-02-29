import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';

export const ILockingApi = Symbol('ILockingApi');

export interface ILockingApi {
  getLeaderboard(args: {
    safeAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<Rank>>;

  getLockingHistory(args: {
    safeAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<LockingEvent>>;
}
