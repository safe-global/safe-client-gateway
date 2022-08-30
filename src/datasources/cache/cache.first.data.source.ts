import { NetworkRequest } from '../../common/network/entities/network.request.entity';
import {
  CacheService,
  ICacheService,
} from '../../common/cache/cache.service.interface';
import {
  INetworkService,
  NetworkService,
} from '../../common/network/network.service.interface';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { LoggerMiddleware } from '../../common/middleware/logger.middleware';
import { HttpErrorFactory } from '../errors/http-error-factory';

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
  private readonly logger = new Logger(LoggerMiddleware.name);

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  /**
   * Gets the JSON payload behind {@link key}. If the value is not
   * present tries to get the respective JSON payload from {@link url}
   * Errors are not cached.
   *
   * @param key - the key to be used to retrieve from cache
   * @param url - the HTTP endpoint to retrieve the JSON payload
   * @param params - the parameters to be used for the HTTP request
   * @param expireTimeSeconds - the time to live in seconds for the payload
   * behind {@link key}
   */
  async get<T>(
    key: string,
    url: string,
    params?: NetworkRequest,
    expireTimeSeconds?: number,
  ): Promise<T> {
    try {
      const cached = await this.cacheService.get<T>(key);
      if (cached != null) {
        this.logger.debug(`[Cache] Cache hit: ${key}`);
        return cached;
      }
      this.logger.debug(`[Cache] Cache miss: ${key}`);
      const { data } = await this.networkService.get(url, params);
      await this.cacheService.set(key, data, expireTimeSeconds);
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
