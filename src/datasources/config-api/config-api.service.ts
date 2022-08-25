import { Injectable } from '@nestjs/common';
import { Page } from './entities/page.entity';
import { Chain } from './entities/chain.entity';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { Inject } from '@nestjs/common';
import {
  INetworkService,
  NetworkService,
} from '../../common/network/network.service.interface';
import { IConfigurationService } from '../../common/config/configuration.service.interface';

@Injectable()
export class ConfigApi {
  private readonly baseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('safeConfig.baseUri');
  }

  async getChains(): Promise<Page<Chain>> {
    try {
      const url = this.baseUri + '/api/v1/chains';
      const response = await this.networkService.get(url);
      return response.data;
    } catch (err) {
      throw this.httpErrorFactory.from(err);
    }
  }

  async getChain(chainId: string): Promise<Chain> {
    try {
      const url = this.baseUri + `/api/v1/chains/${chainId}`;
      const response = await this.networkService.get(url);
      return response.data;
    } catch (err) {
      throw this.httpErrorFactory.from(err);
    }
  }
}
