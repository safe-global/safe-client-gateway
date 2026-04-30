// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';

export const IRelayManager = Symbol('IRelayManager');

export interface IRelayManager {
  /**
   * Gets the appropriate relayer for the given chain ID and (optionally) the
   * transaction calldata. Some transaction types — notably passkey signer
   * deployment via SafeWebAuthnSignerFactory.createSigner — are always
   * sponsored by us and must bypass the noFeeCampaign balance-based rules,
   * so the manager needs to peek at the calldata to route correctly.
   *
   * @param chainId - Chain ID to get relayer for
   * @param data - Transaction calldata. Optional — when omitted, only chain-
   *   level routing applies (e.g. for `getRelaysRemaining`).
   * @returns The relayer instance to use
   */
  getRelayer(chainId: string, data?: Address): IRelayer;
}
