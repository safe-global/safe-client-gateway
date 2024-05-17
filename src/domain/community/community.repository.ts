import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import {
  Campaign,
  CampaignPageSchema,
  CampaignSchema,
} from '@/domain/community/entities/campaign.entity';
import {
  CampaignRank,
  CampaignRankPageSchema,
} from '@/domain/community/entities/campaign-rank.entity';
import { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import { Rank } from '@/domain/community/entities/rank.entity';
import { LockingEventPageSchema } from '@/domain/community/entities/schemas/locking-event.schema';
import {
  RankPageSchema,
  RankSchema,
} from '@/domain/community/entities/schemas/rank.schema';
import { ICommunityRepository } from '@/domain/community/community.repository.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CommunityRepository implements ICommunityRepository {
  constructor(
    @Inject(ILockingApi)
    private readonly lockingApi: ILockingApi,
  ) {}

  async getCampaignById(campaignId: string): Promise<Campaign> {
    const campaign = await this.lockingApi.getCampaignById(campaignId);
    return CampaignSchema.parse(campaign);
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

  async getCampaignLeaderboard(args: {
    campaignId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<CampaignRank>> {
    const page = await this.lockingApi.getCampaignLeaderboard(args);
    return CampaignRankPageSchema.parse(page);
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
