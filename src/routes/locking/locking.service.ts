import { Page } from '@/domain/entities/page.entity';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';
import { ILockingRepository } from '@/domain/locking/locking.repository.interface';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class LockingService {
  constructor(
    @Inject(ILockingRepository)
    private readonly lockingRepository: ILockingRepository,
  ) {}

  async getRank(safeAddress: `0x${string}`): Promise<Rank> {
    return this.lockingRepository.getRank(safeAddress);
  }

  async getLeaderboard(args: {
    routeUrl: URL;
    paginationData: PaginationData;
  }): Promise<Page<Rank>> {
    const result = await this.lockingRepository.getLeaderboard(
      args.paginationData,
    );

    const nextUrl = cursorUrlFromLimitAndOffset(args.routeUrl, result.next);
    const previousUrl = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      result.previous,
    );

    return {
      count: result.count,
      next: nextUrl?.toString() ?? null,
      previous: previousUrl?.toString() ?? null,
      results: result.results,
    };
  }

  async getLockingHistory(args: {
    safeAddress: `0x${string}`;
    routeUrl: URL;
    paginationData: PaginationData;
  }): Promise<Page<LockingEvent>> {
    const result = await this.lockingRepository.getLockingHistory(args);

    const nextUrl = cursorUrlFromLimitAndOffset(args.routeUrl, result.next);
    const previousUrl = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      result.previous,
    );

    return {
      count: result.count,
      next: nextUrl?.toString() ?? null,
      previous: previousUrl?.toString() ?? null,
      results: result.results,
    };
  }
}
