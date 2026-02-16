import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { type Page } from '@/domain/entities/page.entity';
import { IExportApi } from '@/modules/csv-export/v1/datasources/export-api.interface';
import { type TransactionExport } from '@/modules/csv-export/v1/entities/transaction-export.entity';
import { type Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';

@Injectable()
export class ExportApi implements IExportApi {
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async export(args: {
    safeAddress: Address;
    executionDateGte?: string;
    executionDateLte?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<TransactionExport>>> {
    try {
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/export/`;
      return await this.dataSource.get<Page<TransactionExport>>({
        cacheDir: CacheRouter.getTransactionsExportCacheDir({
          ...args,
          chainId: this.chainId,
        }),
        url,
        networkRequest: {
          params: {
            execution_date__gte: args.executionDateGte,
            execution_date__lte: args.executionDateLte,
            limit: args.limit,
            offset: args.offset,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
