import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function campaignRankBuilder(): IBuilder<CampaignRank> {
  return new Builder<CampaignRank>()
    .with('holder', getAddress(faker.finance.ethereumAddress()))
    .with('position', faker.number.int())
    .with('boost', faker.number.float())
    .with('totalPoints', faker.number.float())
    .with('totalBoostedPoints', faker.number.float());
}
