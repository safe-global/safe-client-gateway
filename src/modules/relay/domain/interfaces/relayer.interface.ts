// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { Relay } from '@/modules/relay/domain/entities/relay.entity';
import type { RelayEligibility } from '@/modules/relay/domain/entities/relay-eligibility.entity';

export const IRelayer = Symbol('IRelayer');

export interface IRelayer {
  /**
   * Checks if a relay can be performed for the given address
   * @param {object} args - Chain ID and address to check
   * @param {string} args.chainId - The chain identifier
   * @param {Address} args.address - The address to check relay eligibility for
   * @param {Hex} [args.safeTxHash] - Optional Safe transaction hash for relay-fee eligibility
   * @returns Object containing whether relay is allowed, current count, and limit
   */
  canRelay(args: {
    chainId: string;
    address: Address;
    safeTxHash?: Hex;
  }): Promise<RelayEligibility>;

  /**
   * Performs a relay operation
   * @param {object} args - Relay parameters
   * @param {string} args.version - The contract version
   * @param {string} args.chainId - The chain identifier
   * @param {Address} args.to - The target address
   * @param {Hex} args.data - The transaction data
   * @param {bigint | null} args.gasLimit - The gas limit or null for automatic
   * @param {Hex} [args.safeTxHash] - Optional Safe transaction hash for relay-fee
   * @returns Relay result
   */
  relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
    gasLimit: bigint | null;
    safeTxHash?: Hex;
  }): Promise<Relay>;

  /**
   * Gets the remaining relays and limit for an address
   * @param {object} args - Chain ID and address
   * @param {string} args.chainId - The chain identifier
   * @param {Address} args.address - The address to get remaining relays for
   * @param {Hex} [args.safeTxHash] - Optional Safe transaction hash for relay-fee eligibility
   * @returns Object containing remaining count and limit
   */
  getRelaysRemaining(args: {
    chainId: string;
    address: Address;
    safeTxHash?: Hex;
  }): Promise<{ remaining: number; limit: number }>;
}
