import { Builder, type IBuilder } from '@/__tests__/builder';
import type { Eligibility } from '@/domain/community/entities/eligibility.entity';
import { faker } from '@faker-js/faker/.';

export function eligibilityBuilder(): IBuilder<Eligibility> {
  return new Builder<Eligibility>()
    .with('requestId', faker.string.uuid())
    .with('isAllowed', faker.datatype.boolean())
    .with('isVpn', faker.datatype.boolean());
}
