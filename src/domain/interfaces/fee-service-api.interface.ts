// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { TxFeesRequest } from '@/modules/fees/domain/entities/tx-fees-request.dto';
import type { TxFeesResponse } from '@/modules/fees/domain/entities/tx-fees-response.dto';

export const IFeeServiceApi = Symbol('IFeeServiceApi');

export interface IFeeServiceApi {
  /**
   * Checks if a transaction can be relayed via the fee service
   */
  canRelay(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<{ canRelay: boolean }>;

  /**
   * Gets transaction fees from Fee Service.
   * Internally caches the result.
   * @param args - Chain, safe address, and transaction parameters
   * @returns Fee response with txData, relayCostUsd, and pricingContextSnapshot
   */
  getRelayFees(args: {
    chainId: string;
    safeAddress: Address;
    request: TxFeesRequest;
  }): Promise<TxFeesResponse>;

  /**
   * Checks if 'Pay with Safe' is enabled for the given chain
   */
  isPayWithSafeEnabled(chainId: string): boolean;
}
