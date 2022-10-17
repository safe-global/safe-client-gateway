import { NetworkRequest } from '../network/entities/network.request.entity';
import { CacheService, ICacheService } from './cache.service.interface';
import {
  INetworkService,
  NetworkService,
} from '../network/network.service.interface';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { LoggerMiddleware } from '../../middleware/logger.middleware';

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
  ) {}

  /**
   * Gets the cached value behind the {@link field} of {@link key}.
   * If the value is not present, it tries to get the respective JSON
   * payload from {@link url}.
   * Errors are not cached.
   *
   * @param key - the key to be used to retrieve from cache
   * @param field - the field to get from {@link key}
   * @param url - the HTTP endpoint to retrieve the JSON payload
   * @param params - the parameters to be used for the HTTP request
   * @param expireTimeSeconds - the time to live in seconds for the payload
   * behind {@link key}
   */
  async get<T>(
    key: string,
    field: string,
    url: string,
    params?: NetworkRequest,
    expireTimeSeconds?: number,
  ): Promise<T> {
    const cached = await this.cacheService.get(key, field);
    if (cached != null) {
      this.logger.debug(`[Cache] Cache hit: ${key}`);
      return JSON.parse(cached);
    }
    this.logger.debug(`[Cache] Cache miss: ${key}`);
    const { data } = await this.networkService.get(url, params);
    const rawJson = JSON.stringify(data);
    await this.cacheService.set(key, field, rawJson, expireTimeSeconds);
    return data;
  }

  /**
   * Executes a POST request against an {@link url}, by using
   * the injected NetworkService.
   * Cache is not used by this function.
   *
   * @param url - the HTTP endpoint to retrieve the JSON payload
   * @param data - data to send as request body for the HTTP request
   * @param params - the parameters to be used for the HTTP request
   */
  async post<T>(
    url: string,
    data: object,
    params?: NetworkRequest,
  ): Promise<T> {
    const { data: responseData } = await this.networkService.post(
      url,
      data,
      params,
    );
    return responseData;
  }
}
