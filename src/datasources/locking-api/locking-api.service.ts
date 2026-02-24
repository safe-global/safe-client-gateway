import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { type Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import { type Campaign } from '@/modules/community/domain/entities/campaign.entity';
import { type CampaignActivity } from '@/modules/community/domain/entities/campaign-activity.entity';
import { type CampaignRank } from '@/modules/community/domain/entities/campaign-rank.entity';
import { type LockingEvent } from '@/modules/community/domain/entities/locking-event.entity';
import { type LockingRank } from '@/modules/community/domain/entities/locking-rank.entity';
import { Inject } from '@nestjs/common';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address } from 'viem';

export class LockingApi implements ILockingApi {
  private readonly baseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('locking.baseUri');
  }

  async getCampaignById(resourceId: string): Promise<Raw<Campaign>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${resourceId}`;
      const { data } = await this.networkService.get<Campaign>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Campaign>>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns`;
      const { data } = await this.networkService.get<Page<Campaign>>({
        url,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaignActivities(args: {
    resourceId: string;
    holder?: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<CampaignActivity>>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${args.resourceId}/activities`;
      const { data } = await this.networkService.get<
        Raw<Page<CampaignActivity>>
      >({
        url,
        networkRequest: {
          params: {
            holder: args.holder,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaignRank(args: {
    resourceId: string;
    safeAddress: Address;
  }): Promise<Raw<CampaignRank>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${args.resourceId}/leaderboard/${args.safeAddress}`;
      const { data } = await this.networkService.get<CampaignRank>({
        url,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getLockingRank(safeAddress: Address): Promise<Raw<LockingRank>> {
    try {
      const url = `${this.baseUri}/api/v1/leaderboard/${safeAddress}`;
      const { data } = await this.networkService.get<LockingRank>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<LockingRank>>> {
    try {
      const url = `${this.baseUri}/api/v1/leaderboard`;
      const { data } = await this.networkService.get<Page<LockingRank>>({
        url,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaignLeaderboard(args: {
    resourceId: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<CampaignRank>>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${args.resourceId}/leaderboard`;
      const { data } = await this.networkService.get<Page<CampaignRank>>({
        url,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getLockingHistory(args: {
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<LockingEvent>>> {
    try {
      const url = `${this.baseUri}/api/v1/all-events/${args.safeAddress}`;
      const { data } = await this.networkService.get<Page<LockingEvent>>({
        url,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
