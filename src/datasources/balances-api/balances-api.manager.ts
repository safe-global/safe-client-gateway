import { IConfigurationService } from '@/config/configuration.service.interface';
import { IValkBalancesApi } from '@/datasources/balances-api/valk-balances-api.service';
import { IZerionBalancesApi } from '@/datasources/balances-api/zerion-balances-api.service';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class BalancesApiManager implements IBalancesApiManager {
  private readonly valkBalancesChainIds: string[];
  private readonly valkBalancesApi: IBalancesApi;
  private readonly zerionBalancesChainIds: string[];
  private readonly zerionBalancesApi: IBalancesApi;
  private readonly externalApiChainIds: string[];

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IValkBalancesApi) valkBalancesApi: IBalancesApi,
    @Inject(IZerionBalancesApi) zerionBalancesApi: IBalancesApi,
  ) {
    this.valkBalancesChainIds = this.configurationService.getOrThrow<string[]>(
      'features.valkBalancesChainIds',
    );
    this.zerionBalancesChainIds = this.configurationService.getOrThrow<
      string[]
    >('features.zerionBalancesChainIds');

    this.externalApiChainIds = [
      ...this.valkBalancesChainIds,
      ...this.zerionBalancesChainIds,
    ];

    this.valkBalancesApi = valkBalancesApi;
    this.zerionBalancesApi = zerionBalancesApi;
  }

  useExternalApi(chainId: string): boolean {
    return this.externalApiChainIds.includes(chainId);
  }

  getBalancesApi(chainId: string): IBalancesApi {
    if (this._isSupportedByValk(chainId)) {
      return this.valkBalancesApi;
    }
    if (this._isSupportedByZerion(chainId)) {
      return this.zerionBalancesApi;
    }
    throw new Error(`Chain ID ${chainId} balances provider is not configured`);
  }

  private _isSupportedByValk(chainId: string): boolean {
    return this.valkBalancesChainIds.includes(chainId);
  }

  private _isSupportedByZerion(chainId: string): boolean {
    return this.zerionBalancesChainIds.includes(chainId);
  }
}
