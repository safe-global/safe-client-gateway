import { Inject, Injectable } from '@nestjs/common';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';
import { ISwapsApiFactory } from '@/domain/interfaces/swaps-api.factory';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CowSwapApi } from '@/datasources/swaps-api/cowswap-api.service';

@Injectable()
export class SwapsApiFactory implements ISwapsApiFactory {
  private readonly apis: Record<string, ISwapsApi> = {};

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  get(chainId: string): ISwapsApi {
    if (this.apis[chainId]) {
      return this.apis[chainId];
    }

    const baseUrl = this.configurationService.getOrThrow<string>(
      `swaps.api.${chainId}`,
    );

    this.apis[chainId] = new CowSwapApi(
      baseUrl,
      this.networkService,
      this.httpErrorFactory,
    );
    return this.apis[chainId];
  }
}
