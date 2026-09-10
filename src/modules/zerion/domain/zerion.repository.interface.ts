// SPDX-License-Identifier: FSL-1.1-MIT
export const IZerionRepository = Symbol('IZerionRepository');

export interface IZerionRepository {
  /**
   * Gets Zerion's network names keyed by chain ID for the given environment.
   */
  getNetworkNamesByChainId(isTestnet: boolean): Promise<Record<string, string>>;
}
