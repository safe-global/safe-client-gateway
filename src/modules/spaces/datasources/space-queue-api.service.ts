// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { Page } from '@/domain/entities/page.entity';
import {
  type SpaceQueueTransaction,
  SpaceQueueTransactionPageSchema,
} from '@/modules/spaces/datasources/entities/space-queue-transaction.entity';

export const ISpaceQueueApi = Symbol('ISpaceQueueApi');

export interface ISpaceQueueApi {
  getQueuedTransactions(args: {
    safes: Array<{ chainId: string; address: string }>;
    limit: number;
    offset: number;
  }): Promise<Page<SpaceQueueTransaction>>;
}

@Injectable()
export class SpaceQueueApi implements ISpaceQueueApi {
  private readonly baseUrl: string;

  public constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUrl =
      this.configurationService.getOrThrow<string>('safeQueue.baseUri');
  }

  public async getQueuedTransactions(args: {
    safes: Array<{ chainId: string; address: string }>;
    limit: number;
    offset: number;
  }): Promise<Page<SpaceQueueTransaction>> {
    try {
      const url = new URL(`${this.baseUrl}/api/v1/multisig-transactions/queue`);
      for (const { address, chainId } of args.safes) {
        url.searchParams.append('safes', `${address}:${chainId}`);
      }
      url.searchParams.set('nonce_order', 'asc');
      url.searchParams.set('limit', String(args.limit));
      url.searchParams.set('offset', String(args.offset));
      const { data } = await this.networkService.get<
        Page<SpaceQueueTransaction>
      >({
        url: url.toString(),
      });

      return SpaceQueueTransactionPageSchema.parse(data);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
