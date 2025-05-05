import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';

export const IBridgeRepository = Symbol('IBridgeRepository');

export interface IBridgeRepository {
  getStatus(args: {
    chainId: string;
    txHash: `0x${string}`;
    bridge?: BridgeName;
    toChainId?: string;
  }): Promise<unknown>;

  parseCalldata(args: {
    chainId: string;
    data: `0x${string}`;
  }): Promise<unknown>;
}
