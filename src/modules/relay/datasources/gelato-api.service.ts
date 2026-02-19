// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  type Relay,
  type GelatoRelayResponse,
  GelatoRelayResponseSchema,
} from '@/modules/relay/domain/entities/relay.entity';
import {
  type RelayTaskStatus,
  type GelatoTaskStatusResponse,
  GelatoTaskStatusResponseSchema,
} from '@/modules/relay/domain/entities/relay-task-status.entity';
import type { Address } from 'viem';

@Injectable()
export class GelatoApi implements IRelayApi {
  private readonly baseUri: string;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('relay.baseUri');
  }

  async relay(args: {
    chainId: string;
    to: Address;
    data: string;
  }): Promise<Relay> {
    const apiKey = this.configurationService.getOrThrow<string>(
      `relay.apiKey.${args.chainId}`,
    );

    try {
      const url = `${this.baseUri}/rpc`;
      const { data } = await this.networkService.post<GelatoRelayResponse>({
        url,
        data: {
          id: 1,
          jsonrpc: '2.0',
          method: 'relayer_sendTransaction',
          params: {
            chainId: args.chainId,
            to: args.to,
            data: args.data,
            payment: { type: 'sponsored' },
          },
        },
        networkRequest: {
          headers: {
            'X-API-Key': apiKey,
          },
        },
      });
      const response = GelatoRelayResponseSchema.parse(data);
      return { taskId: response.result };
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Proxies the task status request to Gelato's relayer_getStatus JSON-RPC method.
   * @see https://docs.gelato.cloud/gasless-with-relay/relayer-api-endpoints/relayer/relayer_getstatus
   */
  async getTaskStatus(args: {
    chainId: string;
    taskId: string;
  }): Promise<RelayTaskStatus> {
    const apiKey = this.configurationService.getOrThrow<string>(
      `relay.apiKey.${args.chainId}`,
    );

    try {
      const url = `${this.baseUri}/rpc`;
      const { data } = await this.networkService.post<GelatoTaskStatusResponse>(
        {
          url,
          data: {
            id: 1,
            jsonrpc: '2.0',
            method: 'relayer_getStatus',
            params: {
              id: args.taskId,
              logs: false,
            },
          },
          networkRequest: {
            headers: {
              'X-API-Key': apiKey,
            },
          },
        },
      );

      const response = GelatoTaskStatusResponseSchema.parse(data);
      return response.result;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getRelayCount(args: {
    chainId: string;
    address: Address;
    // TODO: Change to Raw when cache service is migrated
  }): Promise<number> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    const count = await this.cacheService.hGet(cacheDir);
    return count ? parseInt(count) : 0;
  }

  async setRelayCount(args: {
    chainId: string;
    address: Address;
    count: number;
    ttlSeconds: number;
  }): Promise<void> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    await this.cacheService.hSet(
      cacheDir,
      args.count.toString(),
      args.ttlSeconds,
    );
  }
}
