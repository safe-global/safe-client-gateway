import { NetworkRequest } from '../network/entities/network.request.entity';
import { CacheService, ICacheService } from './cache.service.interface';
import {
  INetworkService,
  NetworkService,
} from '../network/network.service.interface';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as winston from 'winston';
import { CacheDir } from './entities/cache-dir.entity';
import { NetworkResponseError } from '../network/entities/network.error.entity';

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
  private readonly ERROR_TTL_SECONDS = 30;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
  ) {}

  /**
   * Gets the cached value behind the {@link CacheDir}.
   * If the value is not present, it tries to get the respective JSON
   * payload from {@link url}.
   * 404 errors are cached with {@link ERROR_TTL_SECONDS} seconds expiration time.
   *
   * @param cacheDir - {@link CacheDir} containing the key and field to be used to retrieve from cache
   * @param url - the HTTP endpoint to retrieve the JSON payload
   * @param params - the parameters to be used for the HTTP request
   * @param expireTimeSeconds - the time to live in seconds for the payload behind {@link CacheDir}
   */
  async get<T>(
    cacheDir: CacheDir,
    url: string,
    params?: NetworkRequest,
    expireTimeSeconds?: number,
  ): Promise<T> {
    const cached = await this.cacheService.get(cacheDir);
    if (cached != null) {
      winston.debug(`[Cache] Cache hit: [${cacheDir.key}, ${cacheDir.field}]`);
      const data = JSON.parse(cached);
      if (this.isNotFoundError(data)) {
        throw new NotFoundException(data.message);
      }
      return data;
    }
    try {
      winston.debug(`[Cache] Cache miss: [${cacheDir.key}, ${cacheDir.field}]`);
      const { data } = await this.networkService.get(url, params);
      const rawJson = JSON.stringify(data);
      await this.cacheService.set(cacheDir, rawJson, expireTimeSeconds);
      return data;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        await this.cacheError(cacheDir, error);
      }
      throw error;
    }
  }

  private isNotFoundError(data: unknown) {
    const error = data as NetworkResponseError;
    return error.status === 404;
  }

  /**
   * Caches an error.
   * @param cacheDir - {@link CacheDir} where the error should be placed
   * @param error - the error to save in cache
   */
  private async cacheError(cacheDir: CacheDir, error: Error): Promise<void> {
    const errorData = error as NetworkResponseError;
    const value = JSON.stringify({
      status: errorData.status,
      message: errorData.message,
    });
    return this.cacheService.set(cacheDir, value, this.ERROR_TTL_SECONDS);
  }
}
