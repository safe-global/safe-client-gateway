import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { SafeConfigPage } from './entities/page.entity';
import { SafeConfigChain } from './entities/chain.entity';

@Injectable()
export class SafeConfigService {
  // TODO: extract base URL to constructor
  constructor(private readonly httpService: HttpService) {}

  async getChains(): Promise<SafeConfigPage<SafeConfigChain>> {
    try {
      const response = await this.httpService.axiosRef.get(
        `https://safe-config.gnosis.io/api/v1/chains`,
      );
      return response.data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getChain(chainId: string): Promise<SafeConfigChain> {
    try {
      const response = await this.httpService.axiosRef.get(
        `https://safe-config.gnosis.io/api/v1/chains/${chainId}`,
      );
      return response.data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
