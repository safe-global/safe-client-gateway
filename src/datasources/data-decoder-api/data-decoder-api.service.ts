import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { Contract } from '@/domain/data-decoder/v2/entities/contract.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import type { Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';

@Injectable()
export class DataDecoderApi implements IDataDecoderApi {
  private readonly baseUrl: string;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheFirstDataSource)
    private readonly dataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUrl = this.configurationService.getOrThrow<string>(
      'safeDataDecoder.baseUri',
    );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  public async getDecodedData(args: {
    data: `0x${string}`;
    to: `0x${string}`;
    chainId: string;
  }): Promise<Raw<DataDecoded>> {
    try {
      const url = `${this.baseUrl}/api/v1/data-decoder`;
      return await this.dataSource.post<DataDecoded>({
        cacheDir: CacheRouter.getDecodedDataCacheDir(args),
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        url,
        data: args,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async getContracts(args: {
    address: `0x${string}`;
    chainIds: Array<string>;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Contract>>> {
    try {
      const url = `${this.baseUrl}/api/v1/contracts/${args.address}`;
      return await this.dataSource.get<Page<Contract>>({
        cacheDir: CacheRouter.getDecodedDataContractsCacheDir(args),
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        url,
        networkRequest: {
          params: {
            chain_ids: args.chainIds.join('&chain_ids='),
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
