import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';

export const ILockingApi = Symbol('ILockingApi');

export interface ILockingApi {
  getRank(safeAddress: string): Promise<Rank>;

  getLeaderboard(): Promise<Array<Rank>>;

  getLockingHistory(safeAddress: string): Promise<Array<LockingEvent>>;
}
