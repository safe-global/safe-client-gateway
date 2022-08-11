import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { SafeConfigPage } from './entities/page.entity';
import { SafeConfigChain } from './entities/chain.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';

@Injectable()
export class SafeConfigService {
  constructor(
    @Inject('SAFE_CONFIG_BASE_URL') private readonly baseUrl,
    private readonly httpService: HttpService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async getChains(): Promise<SafeConfigPage<SafeConfigChain>> {
    try {
      const url = this.baseUrl + '/api/v1/chains';
      const response = await this.httpService.axiosRef.get(url);
      return response.data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }

  async getChain(chainId: string): Promise<SafeConfigChain> {
    try {
      const url = this.baseUrl + `/api/v1/chains/${chainId}`;
      const response = await this.httpService.axiosRef.get(url);
      return response.data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }
}
