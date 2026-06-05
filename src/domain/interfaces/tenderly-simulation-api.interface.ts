// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';

export const ITenderlySimulationApi = Symbol('ITenderlySimulationApi');

export type TenderlySimulationResult =
  | { status: 'success' }
  | { status: 'failed'; reason: string }
  | { status: 'indeterminate'; reason: string };

export interface ITenderlySimulationApi {
  /**
   * Simulates a transaction on Tenderly.
   *
   * @returns
   *   - `{ status: 'success' }` if the simulation ran and the on-chain
   *     transaction would succeed.
   *   - `{ status: 'failed', reason }` if Tenderly confirmed the
   *     transaction would revert (direct revert or `ExecutionFailure`
   *     event for refund-path execTransaction).
   *   - `{ status: 'indeterminate', reason }` if the simulation could not
   *     be completed (network errors, HTTP 4xx/5xx, schema mismatch,
   *     RPC failure fetching the block gas limit, etc.). The caller
   *     should treat this as "unknown" and decide whether to fail-open
   *     or fail-closed based on user intent.
   */
  simulate(args: {
    chainId: string;
    from: Address;
    to: Address;
    data: Hex;
    value?: bigint;
  }): Promise<TenderlySimulationResult>;
}
