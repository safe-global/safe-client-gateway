import type { Address } from 'viem';
import type { Relay } from '@/modules/relay/domain/entities/relay.entity';

export const IRelayer = Symbol('IRelayer');

export interface IRelayer {
  /**
   * Checks if a relay can be performed for the given address
   * @param {object} args - Chain ID and address to check
   * @param {string} args.chainId - The chain identifier
   * @param {Address} args.address - The address to check relay eligibility for
   * @returns Object containing whether relay is allowed, current count, and limit
   */
  canRelay(args: {
    chainId: string;
    address: Address;
  }): Promise<{ result: boolean; currentCount: number; limit: number }>;

  /**
   * Performs a relay operation
   * @param {object} args - Relay parameters
   * @param {string} args.version - The contract version
   * @param {string} args.chainId - The chain identifier
   * @param {Address} args.to - The target address
   * @param {Address} args.data - The transaction data
   * @param {bigint | null} args.gasLimit - The gas limit or null for automatic
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
   * @param {object} args - Chain ID and address
   * @param {string} args.chainId - The chain identifier
   * @param {Address} args.address - The address to get remaining relays for
   * @returns Object containing remaining count and limit
   */
  getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }>;
}
