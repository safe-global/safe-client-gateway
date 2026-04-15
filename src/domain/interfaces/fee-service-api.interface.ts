// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { CanRelayResponse } from '@/modules/fees/domain/entities/can-relay-response.entity';
import type { TxFeesRequest } from '@/modules/fees/domain/entities/tx-fees-request.entity';
import type { TxFeesResponse } from '@/modules/fees/domain/entities/tx-fees-response.entity';

export const IFeeServiceApi = Symbol('IFeeServiceApi');

export interface IFeeServiceApi {
  /**
   * Checks if a transaction can be relayed via the fee service
   */
  canRelay(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<CanRelayResponse>;

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
