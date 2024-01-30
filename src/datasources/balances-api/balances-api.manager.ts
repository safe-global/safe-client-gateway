import { IConfigurationService } from '@/config/configuration.service.interface';
import { IValkBalancesApi } from '@/datasources/balances-api/valk-balances-api.service';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class BalancesApiManager implements IBalancesApiManager {
  private readonly valkBalancesChainIds: string[];
  private readonly valkBalancesApi: IBalancesApi;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IValkBalancesApi) valkBalancesApi: IBalancesApi,
  ) {
    this.valkBalancesChainIds = this.configurationService.getOrThrow<string[]>(
      'features.valkBalancesChainIds',
    );
    this.valkBalancesApi = valkBalancesApi;
  }

  useExternalApi(chainId: string): boolean {
    return this.valkBalancesChainIds.includes(chainId);
  }

  getBalancesApi(chainId: string): IBalancesApi {
    if (this._isSupportedByValk(chainId)) {
      return this.valkBalancesApi;
    }
    throw new Error(`Chain ID ${chainId} balances provider is not configured`);
  }

  private _isSupportedByValk(chainId: string): boolean {
    return this.valkBalancesChainIds.includes(chainId);
  }
}
