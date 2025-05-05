import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LifiBridgeApi } from '@/datasources/bridge-api/lifi-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';
import type { IBridgeApi } from '@/domain/interfaces/bridge-api.inferface';

@Injectable()
export class BridgeApiFactory implements IBridgeApiFactory {
  private readonly apis: Record<string, IBridgeApi> = {};

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(NetworkService) private readonly networkService: INetworkService,
  ) {
    this.apiKey = this.configurationService.getOrThrow<string>('bridge.apiKey');
    this.baseUrl =
      this.configurationService.getOrThrow<string>('bridge.baseUrl');
  }

  getApi(chainId: string): Promise<IBridgeApi> {
    if (this.apis[chainId]) {
      return Promise.resolve(this.apis[chainId]);
    }

    this.apis[chainId] = new LifiBridgeApi(
      chainId,
      this.baseUrl,
      this.apiKey,
      this.networkService,
      this.httpErrorFactory,
    );

    return Promise.resolve(this.apis[chainId]);
  }

  destroyApi(chainId: string): void {
    if (this.apis[chainId] !== undefined) {
      delete this.apis[chainId];
    }
  }
}
