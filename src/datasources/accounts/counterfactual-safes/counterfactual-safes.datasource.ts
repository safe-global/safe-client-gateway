import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class CounterfactualSafesDatasource
  implements ICounterfactualSafesDatasource
{
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  // TODO: the repository calling this function should:
  // - check the AccountDataSettings to see if counterfactual-safes is enabled.
  // - check the AccountDataType to see if it's active.
  async createCounterfactualSafe(
    account: Account,
    createCounterfactualSafeDto: CreateCounterfactualSafeDto,
  ): Promise<CounterfactualSafe> {
    const [counterfactualSafe] = await this.sql<CounterfactualSafe[]>`
      INSERT INTO counterfactual_safes 
      ${this.sql([this.mapCreationDtoToRow(account, createCounterfactualSafeDto)])}
      RETURNING *`;
    const { key } = CacheRouter.getCounterfactualSafesCacheDir(account.address);
    await this.cacheService.deleteByKey(key);
    return counterfactualSafe;
  }

  async getCounterfactualSafe(id: string): Promise<CounterfactualSafe> {
    const cacheDir = CacheRouter.getCounterfactualSafeCacheDir(id);
    const [counterfactualSafe] = await this.getFromCacheOrExecuteAndCache<
      CounterfactualSafe[]
    >(
      cacheDir,
      this.sql<CounterfactualSafe[]>`
        SELECT * FROM counterfactual_safes WHERE id = ${id}`,
      this.defaultExpirationTimeInSeconds,
    );
    return counterfactualSafe;
  }

  getCounterfactualSafesForAccount(
    account: Account,
  ): Promise<CounterfactualSafe[]> {
    const cacheDir = CacheRouter.getCounterfactualSafesCacheDir(
      account.address,
    );
    return this.getFromCacheOrExecuteAndCache<CounterfactualSafe[]>(
      cacheDir,
      this.sql<CounterfactualSafe[]>`
        SELECT * FROM counterfactual_safes WHERE account_id = ${account.id}`,
      this.defaultExpirationTimeInSeconds,
    );
  }

  private mapCreationDtoToRow(
    account: Account,
    createCounterfactualSafeDto: CreateCounterfactualSafeDto,
  ): Partial<CounterfactualSafe> {
    return {
      account_id: account.id,
      chain_id: createCounterfactualSafeDto.chainId,
      creator: account.address,
      fallback_handler: createCounterfactualSafeDto.fallbackHandler,
      owners: createCounterfactualSafeDto.owners,
      predicted_address: createCounterfactualSafeDto.predictedAddress,
      salt_nonce: createCounterfactualSafeDto.saltNonce,
      singleton_address: createCounterfactualSafeDto.singletonAddress,
      threshold: createCounterfactualSafeDto.threshold,
    };
  }

  // TODO: move this repeated function to a common place.
  /**
   * Returns the content from cache or executes the query and caches the result.
   * If the specified {@link CacheDir} is empty, the query is executed and the result is cached.
   * If the specified {@link CacheDir} is not empty, the pointed content is returned.
   *
   * @param cacheDir {@link CacheDir} to use for caching
   * @param query query to execute
   * @param ttl time to live for the cache
   * @returns content from cache or query result
   */
  private async getFromCacheOrExecuteAndCache<T extends postgres.MaybeRow[]>(
    cacheDir: CacheDir,
    query: postgres.PendingQuery<T>,
    ttl: number,
  ): Promise<T> {
    const { key, field } = cacheDir;
    const cached = await this.cacheService.get(cacheDir);
    if (cached != null) {
      this.loggingService.debug({ type: 'cache_hit', key, field });
      return JSON.parse(cached);
    }
    this.loggingService.debug({ type: 'cache_miss', key, field });

    // log & hide database errors
    const result = await query.catch((e) => {
      this.loggingService.error(asError(e).message);
      throw new InternalServerErrorException();
    });

    if (result.count > 0) {
      await this.cacheService.set(cacheDir, JSON.stringify(result), ttl);
    }
    return result;
  }
}
