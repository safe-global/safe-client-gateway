// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

export const IZerionRepository = Symbol('IZerionRepository');

export interface IZerionRepository {
  /**
   * Gets Zerion's chain ID to network name mapping for the given environment.
   */
  getChainIdToNetworkMapping(
    isTestnet: boolean,
  ): Promise<Record<string, string>>;

  /**
   * Spends one call of the shared Zerion budget before a Zerion request.
   *
   * @param args.datasource - Caller label, used for observability
   * @param args.address - When provided, also enforces the per-address budget
   * @throws {LimitReachedError} When the budget is exhausted
   */
  assertWithinBudget(args: {
    datasource: string;
    address?: Address;
  }): Promise<void>;
}
