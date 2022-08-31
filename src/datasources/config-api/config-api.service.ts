import { Injectable } from '@nestjs/common';
import { Page } from './entities/page.entity';
import { Chain } from './entities/chain.entity';
import { Inject } from '@nestjs/common';
import { IConfigurationService } from '../../common/config/configuration.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';

@Injectable()
export class ConfigApi {
  private readonly baseUri: string;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('safeConfig.baseUri');
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const key = `chains-limit=${limit}-offset=${offset}`; // TODO key is not final
    const url = this.baseUri + '/api/v1/chains';
    return await this.dataSource.get(key, url, {
      params: {
        limit: limit,
        offset: offset,
      },
    });
  }

  async getChain(chainId: string): Promise<Chain> {
    const key = `chains-${chainId}`; // TODO key is not final
    const url = this.baseUri + `/api/v1/chains/${chainId}`;
    return await this.dataSource.get(key, url);
  }
}
