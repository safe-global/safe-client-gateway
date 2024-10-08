import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { ActivityMetadata } from '@/domain/community/entities/activity-metadata.entity';
import { faker } from '@faker-js/faker';

export function activityMetadataBuilder(): IBuilder<ActivityMetadata> {
  return new Builder<ActivityMetadata>()
    .with('name', faker.word.words())
    .with('description', faker.lorem.sentence())
    .with('maxPoints', faker.number.int());
}
