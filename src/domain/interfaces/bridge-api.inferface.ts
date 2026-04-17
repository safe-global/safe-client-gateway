// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hash } from 'viem';
import type { BridgeChainPage } from '@/modules/bridge/domain/entities/bridge-chain.entity';
import type { BridgeName } from '@/modules/bridge/domain/entities/bridge-name.entity';
import type { BridgeStatus } from '@/modules/bridge/domain/entities/bridge-status.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IBridgeApi = Symbol('IBridgeApi');

export interface IBridgeApi {
  getChains(): Promise<Raw<BridgeChainPage>>;

  getStatus(args: {
    txHash: Hash;
    bridge?: BridgeName;
    toChain?: string;
  }): Promise<Raw<BridgeStatus>>;
}
