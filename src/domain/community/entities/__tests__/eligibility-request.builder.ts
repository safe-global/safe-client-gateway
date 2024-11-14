import { Builder, type IBuilder } from '@/__tests__/builder';
import { fakeJson } from '@/__tests__/faker';
import type { EligibilityRequest } from '@/domain/community/entities/eligibility-request.entity';
import { faker } from '@faker-js/faker/.';

export function eligibilityRequestBuilder(): IBuilder<EligibilityRequest> {
  return new Builder<EligibilityRequest>()
    .with('requestId', faker.string.uuid())
    .with('sealedData', fakeJson());
}
