import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';
import { LockingEventPageSchema } from '@/domain/locking/entities/schemas/locking-event.schema';
import {
  RankPageSchema,
  RankSchema,
} from '@/domain/locking/entities/schemas/rank.schema';
import { ILockingRepository } from '@/domain/locking/locking.repository.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class LockingRepository implements ILockingRepository {
  constructor(
    @Inject(ILockingApi)
    private readonly lockingApi: ILockingApi,
  ) {}

  async getRank(safeAddress: string): Promise<Rank> {
    const rank = await this.lockingApi.getLeaderboard({ safeAddress });
    return RankSchema.parse(rank.results[0]);
  }

  async getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>> {
    const page = await this.lockingApi.getLeaderboard(args);
    return RankPageSchema.parse(page);
  }

  async getLockingHistory(args: {
    safeAddress: string;
    offset?: number;
    limit?: number;
  }): Promise<Page<LockingEvent>> {
    const page = await this.lockingApi.getLockingHistory(args);
    return LockingEventPageSchema.parse(page);
  }
}
