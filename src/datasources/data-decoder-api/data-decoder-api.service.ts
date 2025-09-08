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
import type { Address } from 'viem';

@Injectable()
export class DataDecoderApi implements IDataDecoderApi {
  private static readonly HOODI_CHAIN_ID = '560048';

  private readonly baseUrl: string;
  private readonly defaultNotFoundExpirationTimeSeconds: number;
  private readonly defaultExpirationTimeSeconds: number;
  private readonly contractNotFoundExpirationTimeSeconds: number;
  private readonly hoodiExpirationTimeSeconds: number;

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
    this.hoodiExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.hoodi',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
    this.defaultExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.contractNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.contract',
      );
  }

  public async getDecodedData(args: {
    data: Address;
    to: Address;
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
    address: Address;
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Contract>>> {
    const { notFoundExpireTimeSeconds, expireTimeSeconds } =
      this.setCacheExpirationTimes(args.chainId, true);
    try {
      const url = `${this.baseUrl}/api/v1/contracts/${args.address}`;
      return await this.dataSource.get<Page<Contract>>({
        cacheDir: CacheRouter.getContractsCacheDir({
          chainId: args.chainId,
          address: args.address,
        }),
        notFoundExpireTimeSeconds,
        expireTimeSeconds,
        url,
        networkRequest: {
          params: {
            chain_ids: [args.chainId].join('&chain_ids='),
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async getTrustedForDelegateCallContracts(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Contract>>> {
    const { notFoundExpireTimeSeconds, expireTimeSeconds } =
      this.setCacheExpirationTimes(args.chainId);
    try {
      const url = `${this.baseUrl}/api/v1/contracts`;
      return await this.dataSource.get<Page<Contract>>({
        cacheDir: CacheRouter.getTrustedForDelegateCallContractsCacheDir(args),
        notFoundExpireTimeSeconds,
        expireTimeSeconds,
        url,
        networkRequest: {
          params: {
            chain_ids: [args.chainId].join('&chain_ids='),
            trusted_for_delegate_call: true,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  private setCacheExpirationTimes(
    chainId: string,
    isContract: boolean = false,
  ): {
    notFoundExpireTimeSeconds: number;
    expireTimeSeconds: number;
  } {
    return chainId === DataDecoderApi.HOODI_CHAIN_ID
      ? {
          notFoundExpireTimeSeconds: this.hoodiExpirationTimeSeconds,
          expireTimeSeconds: this.hoodiExpirationTimeSeconds,
        }
      : {
          notFoundExpireTimeSeconds: isContract
            ? this.contractNotFoundExpirationTimeSeconds
            : this.defaultNotFoundExpirationTimeSeconds,
          expireTimeSeconds: this.defaultExpirationTimeSeconds,
        };
  }
}
