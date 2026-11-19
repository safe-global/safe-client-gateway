// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '#/config/configuration.service.interface';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import type { NetworkRequest } from '#/datasources/network/entities/network.request.entity';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';
import { LogType } from '#/domain/common/entities/log-type.entity';
import type { Page } from '#/domain/entities/page.entity';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import {
  isCreationTransaction,
  isEthereumTransaction,
  isModuleTransaction,
  isMultisigTransaction,
  type Transaction,
} from '#/modules/safe/domain/entities/transaction.entity';
import type { Raw } from '#/validation/entities/raw.entity';

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
  private readonly inFlightGets = new Map<
    string,
    { startTimeMs: number; response: Promise<Raw<unknown>> }
  >();
  private readonly areDebugLogsEnabled: boolean;
  private readonly areConfigHooksDebugLogsEnabled: boolean;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.areDebugLogsEnabled =
      this.configurationService.getOrThrow<boolean>('features.debugLogs');
    this.areConfigHooksDebugLogsEnabled =
      this.configurationService.getOrThrow<boolean>(
        'features.configHooksDebugLogs',
      );
  }

  /**
   * Gets the cached value behind {@link CacheDir}.
   * If the value is not present, it tries to get the respective JSON
   * payload from {@link url}.
   * 404 errors are cached with {@link notFoundExpireTimeSeconds} seconds expiration time.
   *
   * @param args.cacheDir - {@link CacheDir} containing the key and field to be used to retrieve from cache
   * @param args.url - the HTTP endpoint to retrieve the JSON payload
   * @param args.networkRequest - the HTTP request to be used if there is a cache miss
   * @param args.expireTimeSeconds - the time to live in seconds for the payload behind {@link CacheDir}
   * @param args.notFoundExpireTimeSeconds - the time to live in seconds for the error when the item is not found
   */
  async get<T>(args: {
    cacheDir: CacheDir;
    url: string;
    notFoundExpireTimeSeconds: number;
    networkRequest?: NetworkRequest;
    expireTimeSeconds?: number;
  }): Promise<Raw<T>> {
    const {
      cacheDir,
      url,
      networkRequest,
      expireTimeSeconds,
      notFoundExpireTimeSeconds,
    } = args;
    // Request-specific headers and query parameters can change the upstream response.
    const coalescingKey =
      expireTimeSeconds !== undefined &&
      expireTimeSeconds > 0 &&
      !networkRequest?.headers &&
      !networkRequest?.params
        ? () =>
            JSON.stringify([
              cacheDir.key,
              cacheDir.field,
              url,
              expireTimeSeconds,
              notFoundExpireTimeSeconds,
              networkRequest?.timeout,
              networkRequest?.responseType,
              networkRequest?.circuitBreaker?.key,
            ])
        : undefined;
    return await this.tryCache({
      ...args,
      coalescingKey,
      queryFn: (startTimeMs) => {
        return this._getFromNetworkAndWriteCache({
          ...args,
          startTimeMs,
          method: 'get',
        });
      },
    });
  }

  /**
   * Gets the cached value behind {@link CacheDir}.
   * If the value is not present, it tries to get the respective JSON
   * payload from {@link url}.
   * 404 errors are cached with {@link notFoundExpireTimeSeconds} seconds expiration time.
   *
   * @param args.cacheDir - {@link CacheDir} containing the key and field to be used to retrieve from cache
   * @param args.url - the HTTP endpoint to retrieve the JSON payload
   * @param args.networkRequest - the HTTP request to be used if there is a cache miss
   * @param args.expireTimeSeconds - the time to live in seconds for the payload behind {@link CacheDir}
   * @param args.notFoundExpireTimeSeconds - the time to live in seconds for the error when the item is not found
   * @param args.data - the data to be sent in the body of the request
   */
  async post<T>(args: {
    cacheDir: CacheDir;
    url: string;
    notFoundExpireTimeSeconds: number;
    networkRequest?: NetworkRequest;
    expireTimeSeconds?: number;
    data: object;
  }): Promise<Raw<T>> {
    return await this.tryCache({
      ...args,
      queryFn: (startTimeMs) => {
        return this._getFromNetworkAndWriteCache({
          ...args,
          startTimeMs,
          method: 'post',
        });
      },
    });
  }

  /**
   * Gets the cached value behind {@link CacheDir}.
   * If the value is not present, it tries to get the respective JSON
   * payload from {@link queryFn}.
   * 404 errors are cached with {@link notFoundExpireTimeSeconds} seconds expiration time.
   *
   * @param args.cacheDir - {@link CacheDir} containing the key and field to be used to retrieve from cache
   * @param args.notFoundExpireTimeSeconds - the time to live in seconds for the error when the item is not found
   * @param args.fn - the function to be executed if the cache entry is not found
   * @returns the cached value or the result of the function
   */
  private async tryCache<T>(args: {
    cacheDir: CacheDir;
    notFoundExpireTimeSeconds: number;
    queryFn: (startTimeMs: number) => Promise<Raw<T>>;
    coalescingKey?: () => string;
  }): Promise<Raw<T>> {
    const cached = await this.cacheService.hGet(args.cacheDir);
    if (cached != null) {
      return this._getFromCachedData(args.cacheDir, cached);
    }

    const coalescingKey = args.coalescingKey?.();
    if (coalescingKey === undefined) {
      return await this.fetchOnMiss(args, Date.now());
    }

    let inFlight = this.inFlightGets.get(coalescingKey);
    while (inFlight) {
      const invalidationTime = await this.cacheService.getInvalidationTimeMs(
        args.cacheDir.key,
      );
      if (
        invalidationTime === null ||
        invalidationTime < inFlight.startTimeMs
      ) {
        return structuredClone(await inFlight.response);
      }
      const latest = this.inFlightGets.get(coalescingKey);
      if (latest === inFlight) {
        break;
      }
      inFlight = latest;
    }

    const startTimeMs = Date.now();
    const response = this.fetchOnMiss(args, startTimeMs);
    const flight = { startTimeMs, response };
    this.inFlightGets.set(coalescingKey, flight);
    try {
      return await response;
    } finally {
      if (this.inFlightGets.get(coalescingKey) === flight) {
        this.inFlightGets.delete(coalescingKey);
      }
    }
  }

  private async fetchOnMiss<T>(
    args: {
      cacheDir: CacheDir;
      notFoundExpireTimeSeconds: number;
      queryFn: (startTimeMs: number) => Promise<Raw<T>>;
    },
    startTimeMs: number,
  ): Promise<Raw<T>> {
    try {
      return await args.queryFn(startTimeMs);
    } catch (error) {
      if (
        error instanceof NetworkResponseError &&
        error.response.status === 404
      ) {
        await this.cacheNotFoundError(
          args.cacheDir,
          error,
          args.notFoundExpireTimeSeconds,
          startTimeMs,
        );
      }
      throw error;
    }
  }

  /**
   * Gets the data from the contents stored in the cache.
   */
  private _getFromCachedData<T>(
    { key, field }: CacheDir,
    cached: string,
  ): Promise<T> {
    this.loggingService.debug({ type: LogType.CacheHit, key, field });
    const cachedData = JSON.parse(cached);
    if (cachedData?.response?.status === 404) {
      // TODO: create a CachedData type with guard to avoid these type assertions.
      const url: URL = cachedData.url;
      const response: Response = cachedData.response;
      throw new NetworkResponseError(url, response, cachedData?.data);
    }
    return cachedData;
  }

  /**
   * Gets/posts the data from the network and caches the result.
   */
  private async _getFromNetworkAndWriteCache<T>(
    args:
      | {
          cacheDir: CacheDir;
          url: string;
          networkRequest?: NetworkRequest;
          expireTimeSeconds?: number;
          startTimeMs: number;
          method: 'get';
          data?: never;
        }
      | {
          cacheDir: CacheDir;
          url: string;
          networkRequest?: NetworkRequest;
          expireTimeSeconds?: number;
          startTimeMs: number;
          method: 'post';
          data: object;
        },
  ): Promise<Raw<T>> {
    const { key, field } = args.cacheDir;
    const { startTimeMs } = args;
    this.loggingService.debug({ type: LogType.CacheMiss, key, field });
    const { data } = await this.networkService[args.method]<T>({
      url: args.url,
      networkRequest: args.networkRequest,
      data: args.data,
    });

    const written =
      args.expireTimeSeconds !== undefined &&
      args.expireTimeSeconds > 0 &&
      (await this.cacheService.hSetIfFresh(
        args.cacheDir,
        JSON.stringify(data),
        args.expireTimeSeconds,
        startTimeMs,
      ));

    if (written) {
      // TODO: transient logging for debugging
      if (
        this.areDebugLogsEnabled &&
        (args.url.includes('all-transactions') ||
          args.url.includes('multisig-transactions'))
      ) {
        this.logTransactionsCacheWrite(
          startTimeMs,
          args.cacheDir,
          data as unknown as Page<Transaction>,
        );
      }

      if (this.areDebugLogsEnabled && args.cacheDir.key.includes('_safe_')) {
        this.logSafeMetadataCacheWrite(
          startTimeMs,
          args.cacheDir,
          data as unknown as Safe,
        );
      }

      if (
        this.areConfigHooksDebugLogsEnabled &&
        args.cacheDir.key.includes('chain')
      ) {
        this.logChainUpdateCacheWrite(startTimeMs, args.cacheDir, data);
      }
    }
    return data;
  }

  /**
   * Caches a not found error.
   * @param cacheDir - {@link CacheDir} where the error should be placed
   */
  private async cacheNotFoundError(
    cacheDir: CacheDir,
    error: NetworkResponseError,
    notFoundExpireTimeSeconds: number,
    startTimeMs: number,
  ): Promise<void> {
    if (notFoundExpireTimeSeconds <= 0) {
      return;
    }
    await this.cacheService.hSetIfFresh(
      cacheDir,
      JSON.stringify({
        data: error.data,
        response: { status: error.response.status },
        url: error.url,
      }),
      notFoundExpireTimeSeconds,
      startTimeMs,
    );
  }

  /**
   * Logs the type and the hash of the transactions present in the data parameter.
   * NOTE: this is a debugging-only function.
   * TODO: remove this function after debugging.
   */
  private logTransactionsCacheWrite(
    requestStartTime: number,
    cacheDir: CacheDir,
    data: Page<Transaction>,
  ): void {
    this.loggingService.info({
      type: 'cache_write',
      cacheKey: cacheDir.key,
      cacheField: cacheDir.field,
      cacheWriteTime: new Date(),
      requestStartTime: new Date(requestStartTime),
      txHashes:
        Array.isArray(data?.results) && // no validation executed yet at this point
        data.results.map((transaction) => {
          if (isMultisigTransaction(transaction)) {
            return {
              txType: 'multisig',
              safeTxHash: transaction.safeTxHash,
              confirmations: transaction.confirmations,
              confirmationRequired: transaction.confirmationsRequired,
            };
          }
          if (isEthereumTransaction(transaction)) {
            return {
              txType: 'ethereum',
              txHash: transaction.txHash,
            };
          }
          if (isModuleTransaction(transaction)) {
            return {
              txType: 'module',
              transactionHash: transaction.transactionHash,
            };
          }
          if (isCreationTransaction(transaction)) {
            return {
              txType: 'creation',
              transactionHash: transaction.transactionHash,
            };
          }
          return undefined;
        }),
    });
  }

  /**
   * Logs the Safe metadata retrieved.
   * NOTE: this is a debugging-only function.
   * TODO: remove this function after debugging.
   */
  private logSafeMetadataCacheWrite(
    requestStartTime: number,
    cacheDir: CacheDir,
    safe: Safe,
  ): void {
    this.loggingService.info({
      type: 'cache_write',
      cacheKey: cacheDir.key,
      cacheField: cacheDir.field,
      cacheWriteTime: new Date(),
      requestStartTime: new Date(requestStartTime),
      safe,
    });
  }

  /**
   * Logs the chain/chains retrieved.
   * NOTE: this is a debugging-only function.
   * TODO: remove this function after debugging.
   */
  private logChainUpdateCacheWrite(
    requestStartTime: number,
    cacheDir: CacheDir,
    data: unknown,
  ): void {
    this.loggingService.info({
      type: 'cache_write',
      cacheKey: cacheDir.key,
      cacheField: cacheDir.field,
      cacheWriteTime: new Date(),
      requestStartTime: new Date(requestStartTime),
      data,
    });
  }
}
