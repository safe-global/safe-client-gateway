import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { KilnStakingApi } from '@/datasources/staking-api/kiln-api.service';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import { IStakingApi } from '@/domain/interfaces/staking-api.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class StakingApiManager implements IStakingApiManager {
  private readonly apis: Record<string, IStakingApi> = {};

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly httpErrorFactory: HttpErrorFactory,
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

    this.apis[chainId] = new KilnStakingApi(
      baseUrl,
      apiKey,
      this.networkService,
      this.httpErrorFactory,
    );

    return Promise.resolve(this.apis[chainId]);
  }

  destroyApi(chainId: string): void {
    if (this.apis[chainId] !== undefined) {
      delete this.apis[chainId];
    }
  }
}
