// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ChainApiManager } from '@/datasources/common/chain-api.manager';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { ISwapsApiFactory } from '@/domain/interfaces/swaps-api.factory';
import type { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';
import { CowSwapApi } from '@/modules/swaps/datasources/cowswap-api.service';

@Injectable()
export class SwapsApiFactory
  extends ChainApiManager<ISwapsApi>
  implements ISwapsApiFactory
{
  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    super();
  }

  getApi(chainId: string): Promise<ISwapsApi> {
    return this.getOrCreateApi(chainId);
  }

  protected createApi(chainId: string): ISwapsApi {
    const baseUrl = this.configurationService.getOrThrow<string>(
      `swaps.api.${chainId}`,
    );

    return new CowSwapApi(baseUrl, this.networkService, this.httpErrorFactory);
  }
}
