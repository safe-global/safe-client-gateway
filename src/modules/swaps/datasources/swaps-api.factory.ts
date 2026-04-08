// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';
import type { ISwapsApiFactory } from '@/domain/interfaces/swaps-api.factory';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CowSwapApi } from '@/modules/swaps/datasources/cowswap-api.service';

@Injectable()
export class SwapsApiFactory implements ISwapsApiFactory {
  private readonly apis: Record<string, ISwapsApi> = {};

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(HttpErrorFactory)
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  getApi(chainId: string): Promise<ISwapsApi> {
    if (this.apis[chainId]) {
      return Promise.resolve(this.apis[chainId]);
    }

    const baseUrl = this.configurationService.getOrThrow<string>(
      `swaps.api.${chainId}`,
    );

    this.apis[chainId] = new CowSwapApi(
      baseUrl,
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
