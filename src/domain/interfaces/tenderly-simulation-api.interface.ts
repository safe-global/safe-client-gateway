// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';

export const ITenderlySimulationApi = Symbol('ITenderlySimulationApi');

export type TenderlySimulationResult =
  | { success: true }
  | { success: false; reason: string };

export interface ITenderlySimulationApi {
  /**
   * Simulates a transaction on Tenderly.
   *
   * @returns `{ success: true }` if the simulation runs and the on-chain
   *   transaction would succeed; `{ success: false, reason }` if it would
   *   revert or the simulation cannot be completed for any reason
   *   (network errors, invalid responses, etc.).
   */
  simulate(args: {
    chainId: string;
    from: Address;
    to: Address;
    data: Hex;
    value?: bigint;
  }): Promise<TenderlySimulationResult>;
}
