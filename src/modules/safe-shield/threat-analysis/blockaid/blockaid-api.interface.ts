import type { TransactionScanResponse } from '@blockaid/client/resources/index';
import type { Address } from 'viem';

export const IBlockaidApi = Symbol('IBlockaidApi');

export interface IBlockaidApi {
  /**
   * Scans the transaction for potential threats using the Blockaid client
   * @param {string} chainId - The chain ID.
   * @param {Address} safeAddress - The Safe address.
   * @param {Address} walletAddress - The wallet address initiating the transaction (signer).
   * @param {string} message - The JSON representation of typed data.
   * @param {string} origin - The origin identifier for the request (optional).
   * @returns {Promise<TransactionScanResponse>} The scan response.
   */
  scanTransaction(
    chainId: string,
    safeAddress: Address,
    walletAddress: Address,
    message: string,
    origin?: string,
  ): Promise<TransactionScanResponse>;
}
