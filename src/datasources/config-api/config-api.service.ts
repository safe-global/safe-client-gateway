import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../../domain/entities/page.entity';
import { Chain } from '../../domain/chains/entities/chain.entity';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { IConfigApi } from '../../domain/interfaces/config-api.interface';

@Injectable()
export class ConfigApi implements IConfigApi {
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
    const key = `chains`;
    const field = `${limit}_${offset}`;
    const url = `${this.baseUri}/api/v1/chains`;
    return this.dataSource.get(key, field, url, {
      params: {
        limit,
        offset,
      },
    });
  }

  async getChain(chainId: string): Promise<Chain> {
    const key = `${chainId}_chain`;
    const field = '';
    const url = `${this.baseUri}/api/v1/chains/${chainId}`;
    return this.dataSource.get(key, field, url);
  }
}
