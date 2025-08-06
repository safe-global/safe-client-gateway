import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import {
  BridgeStatus,
  BridgeStatusSchema,
} from '@/domain/bridge/entities/bridge-status.entity';
import { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';
import { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import { BridgeChainPageSchema } from '@/domain/bridge/entities/bridge-chain.entity';

@Injectable()
export class BridgeRepository implements IBridgeRepository {
  constructor(
    @Inject(IBridgeApiFactory)
    private readonly bridgeApiFactory: IBridgeApiFactory,
  ) {}

  public async getDiamondAddress(chainId: string): Promise<`0x${string}`> {
    const api = await this.bridgeApiFactory.getApi(chainId);
    const result = await api.getChains();
    const { chains } = BridgeChainPageSchema.parse(result);
    const chain = chains.find((chain) => {
      return chain.id === chainId && chain.diamondAddress;
    });

    if (!chain || !chain.diamondAddress) {
      throw new NotFoundException(`Chain not found. chainId=${chainId}`);
    }

    return chain.diamondAddress;
  }

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
}
