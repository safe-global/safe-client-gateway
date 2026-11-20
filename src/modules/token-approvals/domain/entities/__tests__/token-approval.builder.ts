// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder, type IBuilder } from '#/__tests__/builder';
import type {
  TokenApproval,
  TokenApprovals,
} from '#/modules/token-approvals/domain/entities/token-approval.entity';

export function tokenApprovalBuilder(): IBuilder<TokenApproval> {
  return new Builder<TokenApproval>()
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('spender', getAddress(faker.finance.ethereumAddress()))
    .with('allowance', faker.number.bigInt({ min: 1n }));
}

export function tokenApprovalsBuilder(): IBuilder<TokenApprovals> {
  return new Builder<TokenApprovals>()
    .with('approvals', [tokenApprovalBuilder().build()])
    .with('isHistoryComplete', faker.datatype.boolean());
}
