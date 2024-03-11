import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getLeaderboard(args: {
    safeAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Rank>> {
    throw new Error('Method not implemented.');
  }

  async getLockingHistory(args: {
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<LockingEvent>> {
    try {
      const url = `${this.baseUri}/api/v1/all-events/${args.safeAddress}`;
      const { data } = await this.networkService.get<Page<LockingEvent>>(url, {
        params: {
          limit: args.limit,
          offset: args.offset,
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
