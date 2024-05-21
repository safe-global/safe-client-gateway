import { Page } from '@/domain/entities/page.entity';
import { Campaign } from '@/domain/community/entities/campaign.entity';
import { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import { LockingRank } from '@/domain/community/entities/locking-rank.entity';
import { ICommunityRepository } from '@/domain/community/community.repository.interface';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CommunityService {
  constructor(
    @Inject(ICommunityRepository)
    private readonly communityRepository: ICommunityRepository,
  ) {}

  async getCampaigns(args: {
    routeUrl: URL;
    paginationData: PaginationData;
  }): Promise<Page<Campaign>> {
    const result = await this.communityRepository.getCampaigns(
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

  async getCampaignById(resourceId: string): Promise<Campaign> {
    return this.communityRepository.getCampaignById(resourceId);
  }

  async getCampaignLeaderboard(args: {
    resourceId: string;
    routeUrl: URL;
    paginationData: PaginationData;
  }): Promise<Page<CampaignRank>> {
    const result = await this.communityRepository.getCampaignLeaderboard({
      resourceId: args.resourceId,
      limit: args.paginationData.limit,
      offset: args.paginationData.offset,
    });

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

  async getLockingLeaderboard(args: {
    routeUrl: URL;
    paginationData: PaginationData;
  }): Promise<Page<LockingRank>> {
    const result = await this.communityRepository.getLeaderboard(
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

  async getLockingRank(safeAddress: `0x${string}`): Promise<LockingRank> {
    return this.communityRepository.getLockingRank(safeAddress);
  }

  async getLockingHistory(args: {
    safeAddress: `0x${string}`;
    routeUrl: URL;
    paginationData: PaginationData;
  }): Promise<Page<LockingEvent>> {
    const result = await this.communityRepository.getLockingHistory({
      safeAddress: args.safeAddress,
      limit: args.paginationData.limit,
      offset: args.paginationData.offset,
    });

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
