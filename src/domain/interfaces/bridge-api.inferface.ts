import type { BridgeCalldata } from '@/domain/bridge/entities/bridge-calldata.entity';
import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IBridgeApi = Symbol('IBridgeApi');

export interface IBridgeApi {
  getStatus(args: {
    txHash: `0x${string}`;
    bridge?: BridgeName;
    toChainId?: string;
  }): Promise<Raw<BridgeStatus>>;

  parseCalldata(data: `0x${string}`): Promise<Raw<BridgeCalldata>>;
}
