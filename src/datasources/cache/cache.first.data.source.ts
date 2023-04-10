import { NetworkRequest } from '../network/entities/network.request.entity';
import { CacheService, ICacheService } from './cache.service.interface';
import {
  INetworkService,
  NetworkService,
} from '../network/network.service.interface';
import { Inject, Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { CacheDir } from './entities/cache-dir.entity';

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
  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
  ) {}

  /**
   * Gets the cached value behind the {@link CacheDir}.
   * If the value is not present, it tries to get the respective JSON
   * payload from {@link url}.
   * Errors are not cached.
   *
   * @param cacheDir - {@link CacheDir} containing the key and field to be used to retrieve from cache
   * @param url - the HTTP endpoint to retrieve the JSON payload
   * @param params - the parameters to be used for the HTTP request
   * @param expireTimeSeconds - the time to live in seconds for the payload
   * behind {@link key}
   */
  async get<T>(
    cacheDir: CacheDir,
    url: string,
    params?: NetworkRequest,
    expireTimeSeconds?: number,
  ): Promise<T> {
    const cached = await this.cacheService.get(cacheDir);
    if (cached != null) {
      winston.debug(`[Cache] Cache hit: ${cacheDir.key}`);
      return JSON.parse(cached);
    }
    winston.debug(`[Cache] Cache miss: ${cacheDir.key}`);
    const { data } = await this.networkService.get(url, params);
    const rawJson = JSON.stringify(data);
    await this.cacheService.set(
      new CacheDir(cacheDir.key, cacheDir.field),
      rawJson,
      expireTimeSeconds,
    );
    return data;
  }
}
