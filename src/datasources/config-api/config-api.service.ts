import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { Chain } from '../../domain/chains/entities/chain.entity';
import { Page } from '../../domain/entities/page.entity';
import { IConfigApi } from '../../domain/interfaces/config-api.interface';
import { SafeApp } from '../../domain/safe-apps/entities/safe-app.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheRouter } from '../cache/cache.router';
import { HttpErrorFactory } from '../errors/http-error-factory';

@Injectable()
export class ConfigApi implements IConfigApi {
  private readonly baseUri: string;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('safeConfig.baseUri');
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    try {
      const url = `${this.baseUri}/api/v1/chains`;
      const params = { limit, offset };
      const cacheDir = CacheRouter.getChainsCacheDir(limit, offset);
      return await this.dataSource.get(cacheDir, url, { params });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getChain(chainId: string): Promise<Chain> {
    try {
      const url = `${this.baseUri}/api/v1/chains/${chainId}`;
      const cacheDir = CacheRouter.getChainCacheDir(chainId);
      return await this.dataSource.get(cacheDir, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getSafeApps(
    chainId?: string,
    clientUrl?: string,
    url?: string,
  ): Promise<SafeApp[]> {
    try {
      const providerUrl = `${this.baseUri}/api/v1/safe-apps/`;
      const params = { chainId, clientUrl, url };
      const cacheDir = CacheRouter.getSafeAppsCacheDir(chainId, clientUrl, url);
      return await this.dataSource.get(cacheDir, providerUrl, { params });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
