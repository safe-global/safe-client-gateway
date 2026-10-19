// SPDX-License-Identifier: FSL-1.1-MIT
import type { PublicClient } from 'viem';
import type { IApiManager } from '#/domain/interfaces/api.manager.interface';

export const IBlockchainApiManager = Symbol('IBlockchainApiManager');

export interface IBlockchainApiManager extends IApiManager<PublicClient> {
  /** Returns a client whose RPC calls bypass the RPC cache. */
  getUncachedApi(chainId: string): Promise<PublicClient>;
}
