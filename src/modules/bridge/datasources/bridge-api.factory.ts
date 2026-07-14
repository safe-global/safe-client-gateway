// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { ChainApiManager } from '@/datasources/common/chain-api.manager';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';
import type { IBridgeApi } from '@/domain/interfaces/bridge-api.inferface';
import { LifiBridgeApi } from '@/modules/bridge/datasources/lifi-api.service';

@Injectable()
export class BridgeApiFactory
  extends ChainApiManager<IBridgeApi>
  implements IBridgeApiFactory
{
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(CacheFirstDataSource)
    private readonly cacheFirstDataSource: CacheFirstDataSource,
  ) {
    super();
    this.baseUrl =
      this.configurationService.getOrThrow<string>('bridge.baseUri');
    this.apiKey = this.configurationService.getOrThrow<string>('bridge.apiKey');
  }

  getApi(chainId: string): Promise<IBridgeApi> {
    return this.getOrCreateApi(chainId);
  }

  protected createApi(chainId: string): IBridgeApi {
    return new LifiBridgeApi(
      chainId,
      this.baseUrl,
      this.apiKey,
      this.networkService,
      this.cacheFirstDataSource,
      this.httpErrorFactory,
      this.configurationService,
    );
  }
}
