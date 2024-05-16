import { Builder, IBuilder } from '@/__tests__/builder';
import { CampaignRank } from '@/domain/locking/entities/campaign-rank.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function campaignRankBuilder(): IBuilder<CampaignRank> {
  return new Builder<CampaignRank>()
    .with('holder', getAddress(faker.finance.ethereumAddress()))
    .with('position', faker.number.int())
    .with('boost', faker.string.numeric())
    .with('points', faker.string.numeric())
    .with('boostedPoints', faker.string.numeric());
}
