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
}
