// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { Builder, type IBuilder } from '#/__tests__/builder';
import { tokenSpenderBuilder } from '#/modules/token-approvals/domain/entities/__tests__/token-approval.builder';
import type { TokenApprovalsScanState } from '#/modules/token-approvals/domain/entities/token-approvals-scan-state.entity';

export function tokenApprovalsScanStateBuilder(): IBuilder<TokenApprovalsScanState> {
  return new Builder<TokenApprovalsScanState>()
    .with(
      'pairs',
      faker.helpers.multiple(() => tokenSpenderBuilder().build(), {
        count: { min: 1, max: 3 },
      }),
    )
    .with('lastScannedBlock', faker.number.int({ min: 1, max: 20_000_000 }))
    .with('rangeSize', faker.number.int({ min: 1, max: 100_000 }))
    .with('hasDroppedPairs', false);
}
