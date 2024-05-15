import { IBuilder, Builder } from '@/__tests__/builder';
import { activityMetadataBuilder } from '@/domain/locking/entities/__tests__/activity-metadata.builder';
import { Campaign } from '@/domain/locking/entities/campaign.entity';
import { faker } from '@faker-js/faker';

export function campaignBuilder(): IBuilder<Campaign> {
  return new Builder<Campaign>()
    .with('campaignId', faker.string.uuid())
    .with('name', faker.word.words())
    .with('description', faker.lorem.sentence())
    .with('startDate', faker.date.recent())
    .with('endDate', faker.date.future())
    .with('lastUpdated', faker.date.recent())
    .with(
      'activitiesMetadata',
      Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () =>
        activityMetadataBuilder().build(),
      ),
    );
}

export function toJson(campaign: Campaign): unknown {
  return {
    ...campaign,
    startDate: campaign.startDate.toISOString(),
    endDate: campaign.endDate.toISOString(),
    lastUpdated: campaign.lastUpdated?.toISOString(),
  };
}
