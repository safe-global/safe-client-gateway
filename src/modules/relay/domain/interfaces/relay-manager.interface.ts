// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';

export const IRelayManager = Symbol('IRelayManager');

export interface IRelayManager {
  /**
   * Gets the relayer that pays for the given calldata on a chain, from the
   * chain's `gasPaymentOptions`.
   *
   * @param args.relayer - The chain's relayer (from config service), or `null`
   *   when the chain has no relayer configured.
   * @param args.data - Transaction calldata.
   * @returns The relayer instance to use.
   * @throws GasPaymentOptionUnavailableError when a refunding transaction can't
   *   use `PAY_FROM_SAFE`.
   * @throws NoRelayerDefinedError when the chain offers no option for the calldata.
   * @throws RelayerTypeNotImplementedError when the relayer type is GTF.
   */
  getRelayer(args: { relayer: Chain['relayer']; data: Hex }): IRelayer;

  /**
   * Gets the relayer whose free quota the chain offers, for relays remaining.
   *
   * @param relayer - The chain's relayer, or `null` when none is configured.
   * @returns The no-fee campaign or daily-limit relayer.
   * @throws NoRelayerDefinedError when the chain lists no free option.
   * @throws RelayerTypeNotImplementedError when the relayer type is GTF.
   */
  getFreeRelayer(relayer: Chain['relayer']): IRelayer;
}
