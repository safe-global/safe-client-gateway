// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hash } from 'viem';
import type { BridgeName } from '@/modules/bridge/domain/entities/bridge-name.entity';
import type { BridgeStatus } from '@/modules/bridge/domain/entities/bridge-status.entity';

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
