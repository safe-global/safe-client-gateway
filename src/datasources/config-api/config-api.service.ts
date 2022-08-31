import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { IConfigurationService } from '../../common/config/configuration.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { Page } from '../../common/entities/page.entity';
import { Chain } from '../../chains/entities';

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

  async getChains(): Promise<Page<Chain>> {
    const key = 'chains'; // TODO key is not final
    const url = `${this.baseUri}/api/v1/chains`;
    const page: Page<Chain> = await this.dataSource.get(key, url);

    return page;
  }

  async getChain(chainId: string): Promise<Chain> {
    const key = `chains-${chainId}`; // TODO key is not final
    const url = `${this.baseUri}/api/v1/chains/${chainId}`;
    const chain: Chain = await this.dataSource.get(key, url);

    return chain;
  }
}
