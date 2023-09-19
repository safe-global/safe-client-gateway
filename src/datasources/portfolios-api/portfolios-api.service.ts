import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { DataSourceError } from '../../domain/errors/data-source.error';
import { IPortfoliosApi } from '../../domain/interfaces/portfolios-api.interface';
import { PortfolioResponse } from '../../domain/portfolios/entities/portfolio.entity';
import { PositionsResponse } from '../../domain/portfolios/entities/position.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheRouter } from '../cache/cache.router';
import { CacheService, ICacheService } from '../cache/cache.service.interface';

@Injectable()
export class PortfoliosApi implements IPortfoliosApi {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
  ) {
    this.apiKey = this.configurationService.getOrThrow<string>(
      'portfoliosProvider.apiKey',
    );
    this.baseUrl = this.configurationService.getOrThrow<string>(
      'portfoliosProvider.baseUri',
    );
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async clearPortfolio(args: { safeAddress: string }): Promise<void> {
    await this.cacheService.deleteByKey(CacheRouter.getPortfolioCacheKey(args));
    await this.cacheService.deleteByKey(CacheRouter.getPositionsCacheKey(args));
  }

  async getPositions(args: {
    chainName: string;
    safeAddress: string;
    currency: string;
  }): Promise<PositionsResponse> {
    try {
      const cacheDir = CacheRouter.getPositionsCacheDir(args);
      const { chainName, safeAddress, currency } = args;
      const url = `${this.baseUrl}/wallets/${safeAddress}/positions?chain_id=${chainName}&sort=value&currency=${currency}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: { headers: { authorization: `Basic ${this.apiKey}` } },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (err) {
      throw new DataSourceError(
        `Error getting ${args.safeAddress} positions from provider: ${err?.status}`,
      );
    }
  }

  async getPortfolio(args: {
    safeAddress: string;
    currency: string;
  }): Promise<PortfolioResponse> {
    try {
      const cacheDir = CacheRouter.getPortfolioCacheDir(args);
      const { safeAddress, currency } = args;
      const url = `${this.baseUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: { headers: { authorization: `Basic ${this.apiKey}` } },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (err) {
      throw new DataSourceError(
        `Error getting ${args.safeAddress} portfolio from provider: ${err?.status}`,
      );
    }
  }
}
