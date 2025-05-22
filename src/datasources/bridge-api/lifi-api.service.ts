import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { BridgeQuote } from '@/domain/bridge/entities/bridge-quote.entity';
import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import type { IBridgeApi } from '@/domain/interfaces/bridge-api.inferface';
import type { Raw } from '@/validation/entities/raw.entity';
import type { ExchangeName } from '@/domain/bridge/entities/exchange-name.entity';
import type {
  AllowDenyPrefer,
  RoutePreference,
} from '@/domain/bridge/entities/bridge-preference.entity';
import type { TimingStrategies } from '@/domain/bridge/entities/timing-strategies';
import type { BridgeChainPage } from '@/domain/bridge/entities/bridge-chain.entity';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type {
  BridgeRoutesResponse,
  OrderType,
} from '@/domain/bridge/entities/bridge-route.entity';

export class LifiBridgeApi implements IBridgeApi {
  public static readonly LIFI_API_HEADER = 'x-lifi-api-key';
  private static readonly CHAIN_TYPES = 'EVM';

  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly networkService: INetworkService,
    private readonly cacheFirstDataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
    private readonly configurationService: IConfigurationService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  public async getChains(): Promise<Raw<BridgeChainPage>> {
    const url = `${this.baseUrl}/v1/chains`;
    const cacheDir = CacheRouter.getBridgeChainsCacheDir();
    try {
      return await this.cacheFirstDataSource.get<BridgeChainPage>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            chainTypes: LifiBridgeApi.CHAIN_TYPES,
          },
          headers: {
            [LifiBridgeApi.LIFI_API_HEADER]: this.apiKey,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async getStatus(args: {
    txHash: `0x${string}`;
    bridge?: BridgeName;
    toChain?: string;
  }): Promise<Raw<BridgeStatus>> {
    try {
      const url = `${this.baseUrl}/v1/status`;
      const { data } = await this.networkService.get<BridgeStatus>({
        url,
        networkRequest: {
          params: {
            txHash: args.txHash,
            fromChain: this.chainId,
            toChain: args.toChain,
            bridge: args.bridge,
          },
          headers: {
            [LifiBridgeApi.LIFI_API_HEADER]: this.apiKey,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async getQuote(args: {
    toChain: string;
    fromToken: `0x${string}`;
    toToken: `0x${string}`;
    fromAddress: `0x${string}`;
    toAddress?: `0x${string}`;
    fromAmount: string;
    order?: OrderType;
    slippage?: number;
    integrator?: string;
    fee?: number;
    referrer?: string;
    allowBridges?: Array<RoutePreference<BridgeName>>;
    allowExchanges?: Array<RoutePreference<ExchangeName>>;
    denyBridges?: Array<RoutePreference<BridgeName>>;
    denyExchanges?: Array<RoutePreference<ExchangeName>>;
    preferBridges?: Array<RoutePreference<BridgeName>>;
    preferExchanges?: Array<RoutePreference<ExchangeName>>;
    allowDestinationCall?: boolean;
    fromAmountForGas?: string;
    maxPriceImpact?: number;
    swapStepTimingStrategies?: Array<TimingStrategies>;
    routeTimingStrategies?: Array<TimingStrategies>;
    skipSimulation?: boolean;
  }): Promise<Raw<BridgeQuote>> {
    try {
      // Note: there is also /v1/quote/toAmount to quote based on toAmount
      // rather than fromAmount but as the transaction already exists, we
      // assume the user wants to quote based on fromAmount
      const url = `${this.baseUrl}/v1/quote`;
      const { data } = await this.networkService.get<BridgeQuote>({
        url,
        networkRequest: {
          // TODO: Fix type to allow non-primitives
          // @ts-expect-error - expects primitives
          params: {
            ...args,
            fromChain: this.chainId,
          },
          headers: {
            [LifiBridgeApi.LIFI_API_HEADER]: this.apiKey,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async getRoutes(args: {
    fromChainId: string;
    fromAmount: string;
    fromTokenAddress: string;
    fromAddress?: string;
    toChainId: string;
    toTokenAddress: string;
    toAddress?: string;
    fromAmountForGas?: string;
    options: {
      integrator?: string;
      fee?: number;
      maxPriceImpact?: number;
      order?: OrderType;
      slippage?: number;
      referrer?: string;
      allowSwitchChain?: boolean;
      allowDestinationCall?: boolean;
      bridges?: AllowDenyPrefer<BridgeName>;
      exchanges?: AllowDenyPrefer<ExchangeName>;
      swapStepTimingStrategies?: Array<TimingStrategies>;
      routeTimingStrategies?: Array<TimingStrategies>;
    };
  }): Promise<Raw<BridgeRoutesResponse>> {
    try {
      const url = `${this.baseUrl}/v1/advanced/routes`;
      const { data } = await this.networkService.post<BridgeRoutesResponse>({
        url,
        networkRequest: {
          headers: {
            [LifiBridgeApi.LIFI_API_HEADER]: this.apiKey,
          },
        },
        data: args,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
