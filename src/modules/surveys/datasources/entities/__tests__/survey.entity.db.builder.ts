// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Survey } from '@/modules/surveys/datasources/entities/survey.entity.db';

export function surveyBuilder(): IBuilder<Survey> {
  return new Builder<Survey>()
    .with('id', faker.number.int({ min: 1, max: 1_000_000 }))
    .with('slug', faker.lorem.slug())
    .with('version', faker.number.int({ min: 1, max: 100 }))
    .with('title', faker.lorem.sentence())
    .with('subtitle', null)
    .with('surveyContent', { pages: [] })
    .with('isActive', true)
    .with('createdAt', new Date());
}
