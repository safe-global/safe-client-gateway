import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Page } from './entities/page.entity';
import { Chain } from './entities/chain.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  private readonly baseUri: string;

  constructor(
    private readonly nestConfigService: NestConfigService,
    private readonly httpService: HttpService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {
    this.baseUri = nestConfigService.getOrThrow<string>('safeConfig.baseUri');
  }

  async getChains(): Promise<Page<Chain>> {
    try {
      const url = this.baseUri + '/api/v1/chains';
      const response = await this.httpService.axiosRef.get(url);
      return response.data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }

  async getChain(chainId: string): Promise<Chain> {
    try {
      const url = this.baseUri + `/api/v1/chains/${chainId}`;
      const response = await this.httpService.axiosRef.get(url);
      return response.data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }
}
