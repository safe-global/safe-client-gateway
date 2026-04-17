// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker/.';
import { Builder, type IBuilder } from '@/__tests__/builder';
import { fakeJson } from '@/__tests__/faker';
import type { EligibilityRequest } from '@/modules/community/domain/entities/eligibility-request.entity';

export function eligibilityRequestBuilder(): IBuilder<EligibilityRequest> {
  return new Builder<EligibilityRequest>()
    .with('requestId', faker.string.uuid())
    .with('sealedData', fakeJson());
}
