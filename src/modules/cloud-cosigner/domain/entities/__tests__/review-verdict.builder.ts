// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { Builder, type IBuilder } from '@/__tests__/builder';
import {
  type ReviewVerdict,
  Verdict,
} from '@/modules/cloud-cosigner/domain/entities/review-verdict.entity';

export function reviewVerdictBuilder(): IBuilder<ReviewVerdict> {
  return new Builder<ReviewVerdict>()
    .with('verdict', faker.helpers.enumValue(Verdict))
    .with('confidence', faker.helpers.arrayElement(['low', 'medium', 'high']))
    .with('summary', faker.lorem.sentences(2))
    .with('risk_flags', []);
}
