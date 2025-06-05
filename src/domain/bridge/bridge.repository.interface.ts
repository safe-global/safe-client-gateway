import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';

export const IBridgeRepository = Symbol('IBridgeRepository');

export interface IBridgeRepository {
  getDiamondAddress(chainId: string): Promise<`0x${string}`>;

  getStatus(args: {
    fromChain: string;
    txHash: `0x${string}`;
    bridge?: BridgeName;
    toChain?: string;
  }): Promise<BridgeStatus>;
}
