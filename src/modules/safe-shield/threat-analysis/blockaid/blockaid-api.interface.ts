import type { TransactionScanResponse } from '@blockaid/client/resources/index';
import type { Address } from 'viem';

export const IBlockaidApi = Symbol('IBlockaidApi');

export interface IBlockaidApi {
  /**
   * Scans the transaction for potential threats using the Blockaid client
   * @param chainId - The chain ID.
   * @param safeAddress - The Safe address.
   * @param walletAddress - The wallet address initiating the transaction (signer).
   * @param message - The JSON representation of typed data.
   * @param origin - The origin identifier for the request (optional).
   * @returns The scan response.
   */
  scanTransaction(
    chainId: string,
    safeAddress: Address,
    walletAddress: Address,
    message: string,
    origin?: string,
  ): Promise<TransactionScanResponse>;
}
