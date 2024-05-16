import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import {
  Campaign,
  CampaignPageSchema,
} from '@/domain/locking/entities/campaign.entity';
import {
  Holder,
  HolderPageSchema,
} from '@/domain/locking/entities/holder.entity';
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

  async getCampaignById(campaignId: string): Promise<Campaign> {
    return this.lockingApi.getCampaignById(campaignId);
  }

  async getCampaigns(args: {
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Page<Campaign>> {
    const page = await this.lockingApi.getCampaigns(args);
    return CampaignPageSchema.parse(page);
  }

  async getRank(safeAddress: `0x${string}`): Promise<Rank> {
    const rank = await this.lockingApi.getRank(safeAddress);
    return RankSchema.parse(rank);
  }

  async getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>> {
    const page = await this.lockingApi.getLeaderboard(args);
    return RankPageSchema.parse(page);
  }

  async getLeaderBoardByCampaignId(args: {
    campaignId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Holder>> {
    const page = await this.lockingApi.getLeaderboardV2(args);
    return HolderPageSchema.parse(page);
  }

  async getLockingHistory(args: {
    safeAddress: `0x${string}`;
    offset?: number;
    limit?: number;
  }): Promise<Page<LockingEvent>> {
    const page = await this.lockingApi.getLockingHistory(args);
    return LockingEventPageSchema.parse(page);
  }
}
