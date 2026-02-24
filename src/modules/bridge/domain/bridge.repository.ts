import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IBridgeRepository } from '@/modules/bridge/domain/bridge.repository.interface';
import {
  type BridgeStatus,
  BridgeStatusSchema,
} from '@/modules/bridge/domain/entities/bridge-status.entity';
import { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';
import { type BridgeName } from '@/modules/bridge/domain/entities/bridge-name.entity';
import { BridgeChainPageSchema } from '@/modules/bridge/domain/entities/bridge-chain.entity';
import type { Address, Hash } from 'viem';

@Injectable()
export class BridgeRepository implements IBridgeRepository {
  constructor(
    @Inject(IBridgeApiFactory)
    private readonly bridgeApiFactory: IBridgeApiFactory,
  ) {}

  public async getDiamondAddress(chainId: string): Promise<Address> {
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
    txHash: Hash;
    bridge?: BridgeName;
    fromChain: string;
    toChain?: string;
  }): Promise<BridgeStatus> {
    const api = await this.bridgeApiFactory.getApi(args.fromChain);
    const status = await api.getStatus(args);
    return BridgeStatusSchema.parse(status);
  }
}
