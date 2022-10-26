import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../../domain/entities/page.entity';
import { Chain } from '../../domain/chains/entities/chain.entity';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { IConfigApi } from '../../domain/interfaces/config-api.interface';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { SafeApp } from '../../domain/safe-apps/entities/safe-app.entity';

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
      const cacheKey = `chains`;
      const field = `${limit}_${offset}`;
      const url = `${this.baseUri}/api/v1/chains`;
      return await this.dataSource.get(cacheKey, field, url, {
        params: {
          limit,
          offset,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getChain(chainId: string): Promise<Chain> {
    try {
      const cacheKey = `${chainId}_chain`;
      const field = '';
      const url = `${this.baseUri}/api/v1/chains/${chainId}`;
      return await this.dataSource.get(cacheKey, field, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getSafeApps(chainId: string): Promise<SafeApp[]> {
    try {
      const cacheKey = `${chainId}_safe_apps`;
      const field = '';
      const url = `${this.baseUri}/api/v1/safe-apps/?chainId=${chainId}`;
      return await this.dataSource.get(cacheKey, field, url);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
