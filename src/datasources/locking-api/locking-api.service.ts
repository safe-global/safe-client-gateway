import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';

export class LockingApi implements ILockingApi {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getLeaderboard(args: {
    safeAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getLockingHistory(args: {
    safeAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingEvent>> {
    throw new Error('Method not implemented.');
  }
}
