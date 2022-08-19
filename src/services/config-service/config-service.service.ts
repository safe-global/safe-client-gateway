import { Injectable } from '@nestjs/common';
import { Page } from './entities/page.entity';
import { Chain } from './entities/chain.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import {
  INetworkService,
  NetworkService,
} from '../../common/network/network.service.interface';

@Injectable()
export class ConfigService {
  private readonly baseUri: string;

  constructor(
    private readonly nestConfigService: NestConfigService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {
    this.baseUri = nestConfigService.getOrThrow<string>('safeConfig.baseUri');
  }

  async getChains(): Promise<Page<Chain>> {
    try {
      const url = this.baseUri + '/api/v1/chains';
      const response = await this.networkService.get(url);
      return response.data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }

  async getChain(chainId: string): Promise<Chain> {
    try {
      const url = this.baseUri + `/api/v1/chains/${chainId}`;
      const response = await this.networkService.get(url);
      return response.data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }
}
