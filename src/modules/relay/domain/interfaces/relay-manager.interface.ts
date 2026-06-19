// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import type { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';

export const IRelayManager = Symbol('IRelayManager');

export interface IRelayManager {
  /**
   * Gets the appropriate relayer for the given chain's relayer type and
   * (optionally) the transaction calldata. Some transaction types — notably
   * passkey signer deployment via SafeWebAuthnSignerFactory.createSigner — are
   * always sponsored by us and must bypass the chain's configured relayer,
   * so the manager peeks at the calldata to route correctly.
   *
   * @param relayerType - The chain's relayer type (from config service), or `null`
   *   when the chain has no relayer configured.
   * @param data - Transaction calldata. Optional — when omitted, only
   *   relayerType routing applies (e.g. for `getRelaysRemaining`).
   * @returns The relayer instance to use.
   * @throws NoRelayerDefinedError when relayerType is null.
   * @throws RelayerTypeNotImplementedError when relayerType is GTF.
   */
  getRelayer(relayerType: RelayerType | null, data?: Address): IRelayer;
}
