import type { Address } from 'viem';
import type { Relay } from '@/domain/relay/entities/relay.entity';

export const IRelayer = Symbol('IRelayer');

export interface IRelayer {
  /**
   * Checks if a relay can be performed for the given address
   * @param args - Chain ID and address to check
   * @returns Object containing whether relay is allowed, current count, and limit
   */
  canRelay(args: {
    chainId: string;
    address: Address;
  }): Promise<{ result: boolean; currentCount: number; limit: number }>;

  /**
   * Performs a relay operation
   * @param args - Relay parameters
   * @returns Relay result
   */
  relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Address;
    gasLimit: bigint | null;
  }): Promise<Relay>;

  /**
   * Gets the remaining relays and limit for an address
   * @param args - Chain ID and address
   * @returns Object containing remaining count and limit
   */
  getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }>;
}
