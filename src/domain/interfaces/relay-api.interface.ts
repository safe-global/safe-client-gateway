import type { Relay } from '@/domain/relay/entities/relay.entity';
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

  getRelayCount(args: { chainId: string; address: Address }): Promise<number>;

  getRelayNoFeeCampaignCount(args: {
    chainId: string;
    address: Address;
  }): Promise<number>;

  setRelayCount(args: {
    chainId: string;
    address: Address;
    count: number;
  }): Promise<void>;

  setRelayNoFeeCampaignCount(args: {
    chainId: string;
    address: Address;
    count: number;
    ttlSeconds: number;
  }): Promise<void>;
}
