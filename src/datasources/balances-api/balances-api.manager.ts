import { IConfigurationService } from '@/config/configuration.service.interface';
import { IZerionBalancesApi } from '@/datasources/balances-api/zerion-balances-api.service';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class BalancesApiManager implements IBalancesApiManager {
  private readonly zerionBalancesChainIds: string[];
  private readonly zerionBalancesApi: IBalancesApi;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IZerionBalancesApi) zerionBalancesApi: IBalancesApi,
  ) {
    this.zerionBalancesChainIds = this.configurationService.getOrThrow<
      string[]
    >('features.zerionBalancesChainIds');

    this.zerionBalancesApi = zerionBalancesApi;
  }

  useExternalApi(chainId: string): boolean {
    return this.zerionBalancesChainIds.includes(chainId);
  }

  getBalancesApi(chainId: string): IBalancesApi {
    if (this._isSupportedByZerion(chainId)) {
      return this.zerionBalancesApi;
    }
    throw new Error(`Chain ID ${chainId} balances provider is not configured`);
  }

  getFiatCodes(): string[] {
    return this.zerionBalancesApi.getFiatCodes().sort();
  }

  private _isSupportedByZerion(chainId: string): boolean {
    return this.zerionBalancesChainIds.includes(chainId);
  }
}
