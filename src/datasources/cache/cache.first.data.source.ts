import { NetworkRequest } from '../network/entities/network.request.entity';
import { CacheService, ICacheService } from './cache.service.interface';
import {
  INetworkService,
  NetworkService,
} from '../network/network.service.interface';
import { Inject, Injectable } from '@nestjs/common';
import { CacheDir } from './entities/cache-dir.entity';
import { NetworkResponseError } from '../network/entities/network.error.entity';
import { get } from 'lodash';
import {
  LoggingService,
  ILoggingService,
} from '../../logging/logging.interface';

/**
 * A data source which tries to retrieve values from cache using
 * {@link CacheService} and fallbacks to {@link NetworkService}
 * if the cache entry expired or is not present.
 *
 * This is the recommended data source that should be used when
 * a feature requires both networking and caching the respective
 * responses.
 */
@Injectable()
export class CacheFirstDataSource {
  private readonly defaultNotFoundErrorTTLSeconds = 30;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Gets the cached value behind the {@link CacheDir}.
   * If the value is not present, it tries to get the respective JSON
   * payload from {@link url}.
   * 404 errors are cached with {@link notFoundErrorTTLSeconds} seconds expiration time.
   *
   * @param cacheDir - {@link CacheDir} containing the key and field to be used to retrieve from cache
   * @param url - the HTTP endpoint to retrieve the JSON payload
   * @param networkRequest - the HTTP request to be used if there is a cache miss
   * @param expireTimeSeconds - the time to live in seconds for the payload behind {@link CacheDir}
   * @param notFoundErrorTTLSeconds - the time to live in seconds for the error when the item is not found
   */
  async get<T>(
    cacheDir: CacheDir,
    url: string,
    networkRequest?: NetworkRequest,
    expireTimeSeconds?: number,
    notFoundErrorTTLSeconds?: number,
  ): Promise<T> {
    const cached = await this.cacheService.get(cacheDir);
    if (cached != null) {
      this.loggingService.debug({
        type: 'cache_hit',
        key: cacheDir.key,
        field: cacheDir.field,
      });
      const cachedData = JSON.parse(cached);
      if (get(cachedData, 'status') === 404) {
        throw new NetworkResponseError(cachedData.status, cachedData.data);
      }
      return cachedData;
    }
    try {
      this.loggingService.debug({
        type: 'cache_miss',
        key: cacheDir.key,
        field: cacheDir.field,
      });
      const { data } = await this.networkService.get(url, networkRequest);
      const rawJson = JSON.stringify(data);
      await this.cacheService.set(cacheDir, rawJson, expireTimeSeconds);
      return data;
    } catch (error) {
      if (get(error, 'status') === 404) {
        await this.cacheNotFoundError(
          cacheDir,
          new NetworkResponseError(error.status, error),
          notFoundErrorTTLSeconds,
        );
      }
      throw error;
    }
  }

  /**
   * Caches a not found error.
   * @param cacheDir - {@link CacheDir} where the error should be placed
   */
  private async cacheNotFoundError(
    cacheDir: CacheDir,
    error: NetworkResponseError,
    notFoundErrorTTLSeconds?: number,
  ): Promise<void> {
    const value = JSON.stringify({ status: error.status, data: error });
    return this.cacheService.set(
      cacheDir,
      value,
      notFoundErrorTTLSeconds ?? this.defaultNotFoundErrorTTLSeconds,
    );
  }
}
