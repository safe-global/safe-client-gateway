import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { getFromCacheOrExecuteAndCache } from '@/datasources/db/utils';
import { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
    const [counterfactualSafe] = await getFromCacheOrExecuteAndCache<
      CounterfactualSafe[]
    >(
      this.loggingService,
      this.cacheService,
      cacheDir,
      this.sql<CounterfactualSafe[]>`
        SELECT * FROM counterfactual_safes WHERE id = ${id}`,
      this.defaultExpirationTimeInSeconds,
    );

    if (!counterfactualSafe) {
      throw new NotFoundException('Error getting Counterfactual Safe.');
    }

    return counterfactualSafe;
  }

  getCounterfactualSafesForAccount(
    account: Account,
  ): Promise<CounterfactualSafe[]> {
    const cacheDir = CacheRouter.getCounterfactualSafesCacheDir(
      account.address,
    );
    return getFromCacheOrExecuteAndCache<CounterfactualSafe[]>(
      this.loggingService,
      this.cacheService,
      cacheDir,
      this.sql<CounterfactualSafe[]>`
        SELECT * FROM counterfactual_safes WHERE account_id = ${account.id}`,
      this.defaultExpirationTimeInSeconds,
    );
  }

  async deleteCounterfactualSafe(account: Account, id: string): Promise<void> {
    try {
      const { count } = await this
        .sql`DELETE FROM counterfactual_safes WHERE id = ${id}`;
      if (count === 0) {
        this.loggingService.debug(
          `Error deleting Counterfactual Safe ${id}: not found`,
        );
      }
    } finally {
      await Promise.all([
        this.cacheService.deleteByKey(
          CacheRouter.getCounterfactualSafeCacheDir(id).key,
        ),
        this.cacheService.deleteByKey(
          CacheRouter.getCounterfactualSafesCacheDir(account.address).key,
        ),
      ]);
    }
  }

  async deleteCounterfactualSafesForAccount(account: Account): Promise<void> {
    let deleted: CounterfactualSafe[] = [];
    try {
      const rows = await this.sql<
        CounterfactualSafe[]
      >`DELETE FROM counterfactual_safes WHERE account_id = ${account.id} RETURNING *`;
      deleted = rows;
    } finally {
      await this.cacheService.deleteByKey(
        CacheRouter.getCounterfactualSafesCacheDir(account.address).key,
      );
      await Promise.all(
        deleted.map((row) => {
          return this.cacheService.deleteByKey(
            CacheRouter.getCounterfactualSafeCacheDir(row.id.toString()).key,
          );
        }),
      );
    }
  }

  private mapCreationDtoToRow(
    account: Account,
    createCounterfactualSafeDto: CreateCounterfactualSafeDto,
  ): Partial<CounterfactualSafe> {
    return {
      account_id: account.id,
      chain_id: createCounterfactualSafeDto.chain_id,
      creator: account.address,
      fallback_handler: createCounterfactualSafeDto.fallback_handler,
      owners: createCounterfactualSafeDto.owners,
      predicted_address: createCounterfactualSafeDto.predicted_address,
      salt_nonce: createCounterfactualSafeDto.salt_nonce,
      singleton_address: createCounterfactualSafeDto.singleton_address,
      threshold: createCounterfactualSafeDto.threshold,
    };
  }
}
