import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { KilnApi } from '@/datasources/staking-api/kiln-api.service';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { IStakingApi } from '@/domain/interfaces/staking-api.interface';
import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';

// Note: This mirrors that of StakingApiManager but as each widget deployment
// is its own Kiln "organization", deployments have different base URLs when
// compared to the staking API.

@Injectable()
export class EarnApiManager implements IStakingApiManager {
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

    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);

    const env = chain.isTestnet ? 'testnet' : 'mainnet';

    // Note: only difference to StakingApiManager logic
    const baseUrl = this.configurationService.getOrThrow<string>(
      `earn.${env}.baseUri`,
    );
    const apiKey = this.configurationService.getOrThrow<string>(
      `earn.${env}.apiKey`,
    );

    this.apis[chainId] = new KilnApi(
      baseUrl,
      apiKey,
      this.dataSource,
      this.httpErrorFactory,
      this.configurationService,
      this.cacheService,
      chain.chainId,
      'earn',
    );

    return Promise.resolve(this.apis[chainId]);
  }

  destroyApi(chainId: string): void {
    if (this.apis[chainId] !== undefined) {
      delete this.apis[chainId];
    }
  }
}
