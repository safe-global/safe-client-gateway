import type { TransactionScanResponse } from '@blockaid/client/resources/index';
import type { Address } from 'viem';
import type { ReportEvent } from '../../entities/dtos/report-false-result.dto';

export const IBlockaidApi = Symbol('IBlockaidApi');

/**
 * Extended TransactionScanResponse that includes the request_id from x-request-id header.
 */
export interface TransactionScanResponseWithRequestId extends TransactionScanResponse {
  request_id: string | undefined;
}

export interface IBlockaidApi {
  /**
   * Scans the transaction for potential threats using the Blockaid client
   * @param {string} chainId - The chain ID.
   * @param {Address} safeAddress - The Safe address.
   * @param {Address} walletAddress - The wallet address initiating the transaction (signer).
   * @param {string} message - The JSON representation of typed data.
   * @param {string} origin - The origin identifier for the request (optional).
   * @returns {Promise<TransactionScanResponseWithRequestId>} The scan response with request_id from x-request-id header.
   */
  scanTransaction(
    chainId: string,
    safeAddress: Address,
    walletAddress: Address,
    message: string,
    origin?: string,
  ): Promise<TransactionScanResponseWithRequestId>;

  /**
   * Reports a false positive or false negative transaction scan result to Blockaid
   * using the request_id from a previous scan.
   * @param {ReportEvent} args.event - The type of report.
   * @param {string} args.details - Details about why this is a false result.
   * @param {string} args.requestId - The request_id from the original scan response.
   * @returns {Promise<void>}
   */
  reportTransaction(args: {
    event: ReportEvent;
    details: string;
    requestId: string;
  }): Promise<void>;
}
