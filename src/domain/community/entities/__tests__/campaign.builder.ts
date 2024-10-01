import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { activityMetadataBuilder } from '@/domain/community/entities/__tests__/activity-metadata.builder';
import type { Campaign } from '@/domain/community/entities/campaign.entity';
import { faker } from '@faker-js/faker';

export function campaignBuilder(): IBuilder<Campaign> {
  return new Builder<Campaign>()
    .with('resourceId', faker.string.uuid())
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
    )
    .with('rewardValue', faker.number.float().toString())
    .with('rewardText', faker.lorem.sentence())
    .with('iconUrl', faker.internet.url())
    .with('safeAppUrl', faker.internet.url())
    .with('partnerUrl', faker.internet.url())
    .with('isPromoted', faker.datatype.boolean());
}

export function toJson(campaign: Campaign): unknown {
  return {
    ...campaign,
    startDate: campaign.startDate.toISOString(),
    endDate: campaign.endDate.toISOString(),
    lastUpdated: campaign.lastUpdated?.toISOString(),
  };
}
