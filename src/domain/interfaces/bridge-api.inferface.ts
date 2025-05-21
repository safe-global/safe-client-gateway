import type { BridgeQuote } from '@/domain/bridge/entities/bridge-quote.entity';
import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { ExchangeName } from '@/domain/bridge/entities/exchange-name.entity';
import type { OrderType } from '@/domain/bridge/entities/order-type.entity';
import type { RoutePreference } from '@/domain/bridge/entities/bridge-preference.entity';
import type { TimingStrategies } from '@/domain/bridge/entities/timing-strategies';
import type { BridgeChainPage } from '@/domain/bridge/entities/bridge-chain.entity';

export const IBridgeApi = Symbol('IBridgeApi');

export interface IBridgeApi {
  getChains(): Promise<Raw<BridgeChainPage>>;

  getStatus(args: {
    txHash: `0x${string}`;
    bridge?: BridgeName;
    toChain?: string;
  }): Promise<Raw<BridgeStatus>>;

  getQuote(args: {
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
  }): Promise<Raw<BridgeQuote>>;
}
