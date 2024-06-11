import { Builder, IBuilder } from '@/__tests__/builder';
import { CampaignActivity } from '@/domain/community/entities/campaign-activity.entity';
import { faker } from '@faker-js/faker';

export function campaignActivityBuilder(): IBuilder<CampaignActivity> {
  return new Builder<CampaignActivity>()
    .with('startDate', faker.date.recent())
    .with('endDate', faker.date.future())
    .with('boost', faker.number.float())
    .with('totalPoints', faker.number.float())
    .with('totalBoostedPoints', faker.number.float());
}

export function toJson(campaignActivity: CampaignActivity): unknown {
  return {
    ...campaignActivity,
    startDate: campaignActivity.startDate.toISOString(),
    endDate: campaignActivity.endDate.toISOString(),
  };
}
