import { Inject, Injectable } from '@nestjs/common';
import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import {
  BridgeStatus,
  BridgeStatusSchema,
} from '@/domain/bridge/entities/bridge-status.entity';
import { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';
import {
  BridgeQuote,
  BridgeQuoteSchema,
} from '@/domain/bridge/entities/bridge-quote.entity';
import { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import { ExchangeName } from '@/domain/bridge/entities/exchange-name.entity';
import { OrderType } from '@/domain/bridge/entities/order-type.entity';
import { RoutePreference } from '@/domain/bridge/entities/bridge-preference.entity';
import { TimingStrategies } from '@/domain/bridge/entities/timing-strategies';

@Injectable()
export class BridgeRepository implements IBridgeRepository {
  constructor(
    @Inject(IBridgeApiFactory)
    private readonly bridgeApiFactory: IBridgeApiFactory,
  ) {}

  async getStatus(args: {
    txHash: `0x${string}`;
    bridge?: BridgeName;
    fromChain: string;
    toChain?: string;
  }): Promise<BridgeStatus> {
    const api = await this.bridgeApiFactory.getApi(args.fromChain);
    const status = await api.getStatus(args);
    return BridgeStatusSchema.parse(status);
  }

  async getQuote(args: {
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
  }): Promise<BridgeQuote> {
    const api = await this.bridgeApiFactory.getApi(args.fromChain);
    const calldata = await api.getQuote(args);
    return BridgeQuoteSchema.parse(calldata);
  }
}
