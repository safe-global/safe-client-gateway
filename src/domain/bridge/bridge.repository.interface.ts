import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { BridgeQuote } from '@/domain/bridge/entities/bridge-quote.entity';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import type {
  AllowDenyPrefer,
  RoutePreference,
} from '@/domain/bridge/entities/bridge-preference.entity';
import type {
  BridgeRoute,
  OrderType,
} from '@/domain/bridge/entities/bridge-route.entity';
import type { ExchangeName } from '@/domain/bridge/entities/exchange-name.entity';
import type { TimingStrategies } from '@/domain/bridge/entities/timing-strategies';

export const IBridgeRepository = Symbol('IBridgeRepository');

export interface IBridgeRepository {
  getDiamondAddress(chainId: string): Promise<`0x${string}`>;

  getStatus(args: {
    fromChain: string;
    txHash: `0x${string}`;
    bridge?: BridgeName;
    toChain?: string;
  }): Promise<BridgeStatus>;

  getQuote(args: {
    fromChain: string;
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
  }): Promise<BridgeQuote>;

  getRoutes(args: {
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
  }): Promise<Array<BridgeRoute>>;
}
