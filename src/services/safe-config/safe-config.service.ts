import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { SafeConfigPage } from './entities/page.entity';
import { SafeConfigChain } from './entities/chain.entity';

export interface ISafeConfigService {
  getChains(): Promise<SafeConfigPage<SafeConfigChain>>;
  getChain(chainId: string): Promise<SafeConfigChain>;
}

@Injectable()
export class SafeConfigService {
  constructor(
    @Inject('SAFE_CONFIG_BASE_URL') private readonly baseUrl,
    private readonly httpService: HttpService,
  ) {}

  async getChains(): Promise<SafeConfigPage<SafeConfigChain>> {
    try {
      const url = this.baseUrl + '/api/v1/chains';
      const response = await this.httpService.axiosRef.get(url);
      return response.data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getChain(chainId: string): Promise<SafeConfigChain> {
    try {
      const url = this.baseUrl + `/api/v1/chains/${chainId}`;
      const response = await this.httpService.axiosRef.get(url);
      return response.data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
