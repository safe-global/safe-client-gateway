import { IBuilder, Builder } from '@/__tests__/builder';
import { Campaign } from '@/domain/locking/entities/campaign.entity';
import { faker } from '@faker-js/faker';

export function campaignBuilder(): IBuilder<Campaign> {
  return new Builder<Campaign>()
    .with('campaignId', faker.string.uuid())
    .with('name', faker.word.words())
    .with('description', faker.lorem.sentence())
    .with('periodStart', faker.date.recent())
    .with('periodEnd', faker.date.future())
    .with('lastUpdated', faker.date.recent());
}
