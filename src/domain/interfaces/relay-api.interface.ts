import type { Relay } from '@/domain/relay/entities/relay.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IRelayApi = Symbol('IRelayApi');

export interface IRelayApi {
  relay(args: {
    chainId: string;
    to: `0x${string}`;
    data: string;
    gasLimit: bigint | null;
  }): Promise<Raw<Relay>>;

  getRelayCount(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<number>;

  setRelayCount(args: {
    chainId: string;
    address: `0x${string}`;
    count: number;
  }): Promise<void>;
}
