// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type {
  CounterpartyAnalysisResponse,
  SingleRecipientAnalysisResponse,
} from '@/modules/safe-shield/entities/analysis-responses.entity';

export const ISafeShieldAnalysis = Symbol('ISafeShieldAnalysis');

/**
 * The recipient/counterparty analysis Safe Shield exposes free on Core and,
 * gated by plan, on Spaces. Reached through this token so a gated module
 * never imports `SafeShieldService`/`safe-shield`'s `routes/` layer directly
 * (see `IEntitlementEnforcement` for the same pattern).
 */
export interface ISafeShieldAnalysis {
  analyzeRecipient(
    chainId: string,
    safeAddress: Address,
    recipientAddress: Address,
  ): Promise<SingleRecipientAnalysisResponse>;

  analyzeCounterparty(args: {
    chainId: string;
    safeAddress: Address;
    tx: {
      to: Address;
      value: string;
      data: Hex;
      operation: Operation;
    };
  }): Promise<CounterpartyAnalysisResponse>;
}
