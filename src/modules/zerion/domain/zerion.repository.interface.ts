// SPDX-License-Identifier: FSL-1.1-MIT
export const IZerionRepository = Symbol('IZerionRepository');

export interface IZerionRepository {
  /**
   * Gets Zerion's chain ID to network name mapping for the given environment.
   */
  getChainIdToNetworkMapping(
    isTestnet: boolean,
  ): Promise<Record<string, string>>;
}
