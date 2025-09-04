import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import type { Address, Hash } from 'viem';

export const IBridgeRepository = Symbol('IBridgeRepository');

export interface IBridgeRepository {
  getDiamondAddress(chainId: string): Promise<Address>;

  getStatus(args: {
    fromChain: string;
    txHash: Hash;
    bridge?: BridgeName;
    toChain?: string;
  }): Promise<BridgeStatus>;
}
