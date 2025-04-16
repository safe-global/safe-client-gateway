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

@Injectable()
export class StakingApiManager implements IStakingApiManager {
  private readonly apis: Record<string, IStakingApi> = {};
  private readonly BASE_CHAIN_ID = '8453';
  private readonly isBaseProductionActive: boolean;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
  ) {
    this.isBaseProductionActive = this.configurationService.getOrThrow<boolean>(
      'staking.isBaseProductionActive',
    );
  }

  async getApi(chainId: string): Promise<IStakingApi> {
    if (this.apis[chainId]) {
      return Promise.resolve(this.apis[chainId]);
    }

    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);

    // TODO: remove this check and the associated configuration once Base is
    // fully migrated to the Kiln mainnet API.
    const isBaseTestnet =
      chainId === this.BASE_CHAIN_ID && !this.isBaseProductionActive;
    const env = isBaseTestnet || chain.isTestnet ? 'testnet' : 'mainnet';

    const baseUrl = this.configurationService.getOrThrow<string>(
      `staking.${env}.baseUri`,
    );
    const apiKey = this.configurationService.getOrThrow<string>(
      `staking.${env}.apiKey`,
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
