import type { TransactionScanResponse } from '@blockaid/client/resources/index';
import type { Address } from 'viem';

export const IBlockaidApi = Symbol('IBlockaidApi');

export interface IBlockaidApi {
  /**
   * Scans the transaction for potential threats using the Blockaid client
   * @param chainId - The chain ID.
   * @param safeAddress - The Safe address.
   * @param message - The JSON representation of typed data.
   * @returns The scan response.
   */
  scanTransaction(
    chainId: string,
    safeAddress: Address,
    message: string,
  ): Promise<TransactionScanResponse>;
}
