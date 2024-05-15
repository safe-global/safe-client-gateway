import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import { Campaign } from '@/domain/locking/entities/campaign.entity';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import { Rank } from '@/domain/locking/entities/rank.entity';
import { Inject } from '@nestjs/common';

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

  async getCampaignById(campaignId: string): Promise<Campaign> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${campaignId}`;
      const { data } = await this.networkService.get<Campaign>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Campaign>> {
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

  async getRank(safeAddress: `0x${string}`): Promise<Rank> {
    try {
      const url = `${this.baseUri}/api/v1/leaderboard/${safeAddress}`;
      const { data } = await this.networkService.get<Rank>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>> {
    try {
      const url = `${this.baseUri}/api/v1/leaderboard`;
      const { data } = await this.networkService.get<Page<Rank>>({
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
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingEvent>> {
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
