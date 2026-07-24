// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { ChainApiManager } from '@/datasources/common/chain-api.manager';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { IStakingApi } from '@/domain/interfaces/staking-api.interface';
import type { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import { ChainSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import { KilnApi } from '@/modules/staking/datasources/kiln-api.service';

/**
 * Manages per-chain {@link KilnApi} instances for a given widget deployment.
 *
 * Each widget deployment (`staking`, `earn`) is its own Kiln "organization",
 * so each has its own base URLs and API keys in configuration.
 */
export abstract class KilnApiManager
  extends ChainApiManager<IStakingApi>
  implements IStakingApiManager
{
  protected abstract readonly widget: 'staking' | 'earn';

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
  ) {
    super();
  }

  getApi(chainId: string): Promise<IStakingApi> {
    return this.getOrCreateApi(chainId);
  }

  protected async createApi(chainId: string): Promise<IStakingApi> {
    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);

    const env = chain.isTestnet ? 'testnet' : 'mainnet';

    const baseUrl = this.configurationService.getOrThrow<string>(
      `${this.widget}.${env}.baseUri`,
    );
    const apiKey = this.configurationService.getOrThrow<string>(
      `${this.widget}.${env}.apiKey`,
    );

    return new KilnApi(
      baseUrl,
      apiKey,
      this.dataSource,
      this.httpErrorFactory,
      this.configurationService,
      this.cacheService,
      chain.chainId,
      this.widget,
    );
  }
}
