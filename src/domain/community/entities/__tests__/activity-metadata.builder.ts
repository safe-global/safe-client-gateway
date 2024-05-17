import { Builder, IBuilder } from '@/__tests__/builder';
import { ActivityMetadata } from '@/domain/community/entities/activity-metadata.entity';
import { faker } from '@faker-js/faker';

export function activityMetadataBuilder(): IBuilder<ActivityMetadata> {
  return new Builder<ActivityMetadata>()
    .with('campaignId', faker.string.uuid())
    .with('name', faker.word.words())
    .with('description', faker.lorem.sentence())
    .with('maxPoints', faker.string.numeric());
}
