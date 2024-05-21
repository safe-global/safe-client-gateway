import { Builder, IBuilder } from '@/__tests__/builder';
import { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function campaignRankBuilder(): IBuilder<CampaignRank> {
  return new Builder<CampaignRank>()
    .with('holder', getAddress(faker.finance.ethereumAddress()))
    .with('position', faker.number.int())
    .with('boost', faker.number.float())
    .with('points', faker.number.float())
    .with('boostedPoints', faker.number.float());
}
