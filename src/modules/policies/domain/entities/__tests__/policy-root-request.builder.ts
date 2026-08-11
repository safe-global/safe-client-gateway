// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { hexBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import {
  type PolicyRootRequest,
  PolicyRootRequestStatus,
} from '@/modules/policies/domain/entities/policy-root-request.entity';

export function policyRootRequestBuilder(): IBuilder<PolicyRootRequest> {
  return new Builder<PolicyRootRequest>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('guard', getAddress(faker.finance.ethereumAddress()))
    .with('root', hexBuilder(32))
    .with('validFrom', faker.date.soon())
    .with('status', PolicyRootRequestStatus.Pending)
    .with('invalidatedAt', null)
    .with('transactionHash', hexBuilder(32))
    .with('blockNumber', faker.number.int({ min: 1, max: 1_000_000 }))
    .with('logIndex', faker.number.int({ min: 0, max: 10 }))
    .with('timestamp', faker.date.recent());
}
