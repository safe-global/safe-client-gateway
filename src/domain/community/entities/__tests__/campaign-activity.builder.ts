import { Builder, IBuilder } from '@/__tests__/builder';
import { CampaignActivity } from '@/domain/community/entities/campaign-activity.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function campaignActivityBuilder(): IBuilder<CampaignActivity> {
  return new Builder<CampaignActivity>()
    .with('holder', getAddress(faker.finance.ethereumAddress()))
    .with('startDate', faker.date.recent())
    .with('endDate', faker.date.future())
    .with('boost', faker.string.numeric())
    .with('totalPoints', faker.string.numeric())
    .with('totalBoostedPoints', faker.string.numeric());
}

export function toJson(campaignActivity: CampaignActivity): unknown {
  return {
    ...campaignActivity,
    startDate: campaignActivity.startDate.toISOString(),
    endDate: campaignActivity.endDate.toISOString(),
  };
}
