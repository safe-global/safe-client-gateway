import { Builder, IBuilder } from '@/__tests__/builder';
import { CampaignPoints } from '@/domain/community/entities/campaign-points.entity';
import { faker } from '@faker-js/faker';

export function campaignPointsBuilder(): IBuilder<CampaignPoints> {
  return new Builder<CampaignPoints>()
    .with('startDate', faker.date.recent())
    .with('endDate', faker.date.future())
    .with('boost', faker.number.float())
    .with('totalPoints', faker.number.float())
    .with('totalBoostedPoints', faker.number.float());
}

export function toJson(campaignPoints: CampaignPoints): unknown {
  return {
    ...campaignPoints,
    startDate: campaignPoints.startDate.toISOString(),
    endDate: campaignPoints.endDate.toISOString(),
  };
}
