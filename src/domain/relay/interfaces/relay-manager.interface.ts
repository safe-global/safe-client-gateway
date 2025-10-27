import type { Address } from 'viem';
import type { Relay } from '@/domain/relay/entities/relay.entity';
import type { IRelayer } from '@/domain/relay/interfaces/relayer.interface';

export const IRelayManager = Symbol('IRelayManager');

export interface IRelayManager {
  /**
   * Gets the appropriate relayer for the given chain ID
   * @param chainId - Chain ID to get relayer for
   * @returns The relayer instance to use
   */
  getRelayer(chainId: string): IRelayer;

  /**
   * Performs a relay operation using the appropriate relayer
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
   * Gets the remaining relays and limit for an address using the appropriate relayer
   * @param args - Chain ID and address
   * @returns Object containing remaining count and limit
   */
  getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }>;
}
