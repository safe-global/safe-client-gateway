import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { Page } from '@/domain/entities/page.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { SafeApp } from '@/domain/safe-apps/entities/safe-app.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheRouter } from '../cache/cache.router';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { CacheService, ICacheService } from '../cache/cache.service.interface';

@Injectable()
export class ConfigApi implements IConfigApi {
  private readonly baseUri: string;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('safeConfig.baseUri');
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async getChains(args: {
    limit?: number;
    offset?: number;
  }): Promise<Page<Chain>> {
    try {
      const url = `${this.baseUri}/api/v1/chains`;
      const params = { limit: args.limit, offset: args.offset };
      const cacheDir = CacheRouter.getChainsCacheDir(args);
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: { params },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearChains(): Promise<void> {
    const pattern = CacheRouter.getChainsCachePattern();
    await Promise.all([
      this.cacheService.deleteByKey(CacheRouter.getChainsCacheKey()),
      this.cacheService.deleteByKeyPattern(pattern),
    ]);
  }

  async getChain(chainId: string): Promise<Chain> {
    try {
      const url = `${this.baseUri}/api/v1/chains/${chainId}`;
      const cacheDir = CacheRouter.getChainCacheDir(chainId);
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: undefined,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getSafeApps(args: {
    chainId?: string;
    clientUrl?: string;
    url?: string;
  }): Promise<SafeApp[]> {
    try {
      const providerUrl = `${this.baseUri}/api/v1/safe-apps/`;
      const params = {
        chainId: args.chainId,
        clientUrl: args.clientUrl,
        url: args.url,
      };
      const cacheDir = CacheRouter.getSafeAppsCacheDir(args);
      return await this.dataSource.get({
        cacheDir,
        url: providerUrl,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: { params },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearSafeApps(): Promise<void> {
    const pattern = CacheRouter.getSafeAppsCachePattern();
    await this.cacheService.deleteByKeyPattern(pattern);
  }
}
