import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';

export class LockingApi implements ILockingApi {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRank(_safeAddress: string): Promise<Rank> {
    throw new Error('Method not implemented.');
  }

  async getLeaderboard(): Promise<Array<Rank>> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getLockingHistory(_safeAddress: string): Promise<Array<LockingEvent>> {
    throw new Error('Method not implemented.');
  }
}
