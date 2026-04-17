// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { CanRelayResponse } from '@/modules/fees/domain/entities/can-relay-response.entity';
import type { TxFeesRequest } from '@/modules/fees/domain/entities/tx-fees-request.entity';
import type { TxFeesResponse } from '@/modules/fees/domain/entities/tx-fees-response.entity';

export const IFeeServiceApi = Symbol('IFeeServiceApi');

export interface IFeeServiceApi {
  /**
   * Checks with the fee service whether a transaction can be relayed.
   *
   * @param args.chainId - Chain ID
   * @param args.safeTxHash - Safe transaction hash to check relay eligibility for
   * @returns Object indicating whether the transaction can be relayed
   * @throws {DataSourceError} If the fee service request fails
   */
  canRelay(args: {
    chainId: string;
    safeTxHash: Hex;
  }): Promise<CanRelayResponse>;

  /**
   * Gets transaction relay fees from the fee service.
   *
   * @param args.chainId - Chain ID
   * @param args.safeAddress - Safe address initiating the relay
   * @param args.request - Transaction parameters for fee calculation
   * @returns Fee response with txData, relayCostUsd, and pricingContextSnapshot
   * @throws {DataSourceError} If the fee service request fails
   */
  getRelayFees(args: {
    chainId: string;
    safeAddress: Address;
    request: TxFeesRequest;
  }): Promise<TxFeesResponse>;

  /**
   * Checks if 'Pay with Safe' is enabled for the given chain.
   *
   * @param chainId - Chain ID to check
   * @returns `true` if Pay with Safe is enabled for the chain, `false` otherwise
   */
  isPayWithSafeEnabled(chainId: string): boolean;
}
