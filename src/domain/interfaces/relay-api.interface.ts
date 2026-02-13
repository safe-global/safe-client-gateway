import type { Relay } from '@/modules/relay/domain/entities/relay.entity';
import type { RelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address } from 'viem';

export const IRelayApi = Symbol('IRelayApi');

export interface IRelayApi {
  relay(args: {
    chainId: string;
    to: Address;
    data: string;
    gasLimit: bigint | null;
  }): Promise<Raw<Relay>>;

  getTaskStatus(args: {
    chainId: string;
    taskId: string;
  }): Promise<RelayTaskStatus>;

  getRelayCount(args: { chainId: string; address: Address }): Promise<number>;

  setRelayCount(args: {
    chainId: string;
    address: Address;
    count: number;
    ttlSeconds: number;
  }): Promise<void>;
}
