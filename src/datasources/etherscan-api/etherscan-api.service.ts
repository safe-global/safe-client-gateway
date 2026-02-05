import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEtherscanApi } from '@/domain/interfaces/etherscan-api.interface';
import { GasPriceResponse } from '@/modules/chains/routes/entities/gas-price-response.entity';
import { Raw } from '@/validation/entities/raw.entity';

@Injectable()
export class EtherscanApi implements IEtherscanApi {
  private readonly baseUri: string = 'https://api.etherscan.io/v2/api';
  private readonly apiKey: string | undefined;
  private readonly cacheTimeSeconds: number;
  private readonly notFoundCacheTimeSeconds: number;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.get<string>('etherscan.apiKey');
    this.cacheTimeSeconds = this.configurationService.getOrThrow<number>(
      'etherscan.gasPriceCacheTtlSeconds',
    );
    this.notFoundCacheTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async getGasPrice(chainId: string): Promise<Raw<GasPriceResponse>> {
    try {
      const url = this.buildGasPriceUrl(chainId);
      const cacheDir = CacheRouter.getGasPriceCacheDir(chainId);

      return await this.dataSource.get<GasPriceResponse>({
        cacheDir,
        url,
        expireTimeSeconds: this.cacheTimeSeconds,
        notFoundExpireTimeSeconds: this.notFoundCacheTimeSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  private buildGasPriceUrl(chainId: string): string {
    const url = new URL(this.baseUri);
    url.searchParams.set('chainid', chainId);
    url.searchParams.set('module', 'gastracker');
    url.searchParams.set('action', 'gasoracle');

    if (this.apiKey) {
      url.searchParams.set('apikey', this.apiKey);
    }

    return url.toString();
  }
}
