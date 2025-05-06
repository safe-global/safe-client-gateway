import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { BridgeQuote } from '@/domain/bridge/entities/bridge-quote.entity';
import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import type { IBridgeApi } from '@/domain/interfaces/bridge-api.inferface';
import type { Raw } from '@/validation/entities/raw.entity';
import type { ExchangeName } from '@/domain/bridge/entities/exchange-name.entity';
import type { OrderType } from '@/domain/bridge/entities/order-type.entity';
import type { RoutePreference } from '@/domain/bridge/entities/bridge-preference.entity';
import type { TimingStrategies } from '@/domain/bridge/entities/timing-strategies';

export class LifiBridgeApi implements IBridgeApi {
  private static readonly LIFI_API_HEADER = 'x-lifi-api-key';

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

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
      const { data } = await this.networkService.post<BridgeQuote>({
        url,
        data: {
          ...args,
          fromChain: this.chainId,
        },
        networkRequest: {
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
}
