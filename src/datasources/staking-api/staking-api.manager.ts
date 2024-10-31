import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { KilnApi } from '@/datasources/staking-api/kiln-api.service';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { IStakingApi } from '@/domain/interfaces/staking-api.interface';
import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class StakingApiManager implements IStakingApiManager {
  private readonly apis: Record<string, IStakingApi> = {};

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
  ) {}

  async getApi(chainId: string): Promise<IStakingApi> {
    if (this.apis[chainId]) {
      return Promise.resolve(this.apis[chainId]);
    }

    const chain = await this.configApi.getChain(chainId);

    const baseUrl = this.configurationService.getOrThrow<string>(
      chain.isTestnet ? 'staking.testnet.baseUri' : 'staking.mainnet.baseUri',
    );
    const apiKey = this.configurationService.getOrThrow<string>(
      chain.isTestnet ? 'staking.testnet.apiKey' : 'staking.mainnet.apiKey',
    );

    this.apis[chainId] = new KilnApi(
      baseUrl,
      apiKey,
      this.dataSource,
      this.httpErrorFactory,
      this.configurationService,
      this.cacheService,
      chain.chainId,
    );

    return Promise.resolve(this.apis[chainId]);
  }

  destroyApi(chainId: string): void {
    if (this.apis[chainId] !== undefined) {
      delete this.apis[chainId];
    }
  }
}
