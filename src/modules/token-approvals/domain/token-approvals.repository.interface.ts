// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { TokenApprovals } from '#/modules/token-approvals/domain/entities/token-approval.entity';

export const ITokenApprovalsRepository = Symbol('ITokenApprovalsRepository');

export interface ITokenApprovalsRepository {
  /**
   * Returns the ERC-20 allowances a Safe has given that are still above zero.
   *
   * The token and spender pairs come from the Safe's executed multisig and
   * module transactions. Approvals signed off-chain (EIP-2612 `permit`,
   * Permit2) are not part of that history and are not returned.
   */
  getTokenApprovals(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<TokenApprovals>;
}
