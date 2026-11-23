// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { TokenApprovals } from '#/modules/token-approvals/domain/entities/token-approval.entity';

export const ITokenApprovalsRepository = Symbol('ITokenApprovalsRepository');

export interface ITokenApprovalsRepository {
  /**
   * Returns the ERC-20 allowances a Safe has given that are still above zero,
   * however they were given.
   *
   * The token and spender pairs come from the `Approval` logs that name the
   * Safe as owner; each allowance is read on chain at the latest block.
   */
  getTokenApprovals(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<TokenApprovals>;
}
