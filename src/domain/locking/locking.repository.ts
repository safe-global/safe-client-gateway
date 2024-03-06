import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';
import { LockingEventValidator } from '@/domain/locking/locking-event.validator';
import { ILockingRepository } from '@/domain/locking/locking.repository.interface';
import { RankValidator } from '@/domain/locking/rank.validator';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class LockingRepository implements ILockingRepository {
  constructor(
    @Inject(ILockingApi)
    private readonly lockingApi: ILockingApi,
    private readonly rankValidator: RankValidator,
    private readonly lockingEventValidator: LockingEventValidator,
  ) {}

  async getRank(safeAddress: string): Promise<Rank> {
    const rank = await this.lockingApi.getLeaderboard({ safeAddress });
    return this.rankValidator.validate(rank.results[0]);
  }

  async getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>> {
    const page = await this.lockingApi.getLeaderboard(args);
    return this.rankValidator.validatePage(page);
  }

  async getLockingHistory(args: {
    safeAddress: string;
    offset?: number;
    limit?: number;
  }): Promise<Page<LockingEvent>> {
    const page = await this.lockingApi.getLockingHistory(args);
    return this.lockingEventValidator.validatePage(page);
  }
}
