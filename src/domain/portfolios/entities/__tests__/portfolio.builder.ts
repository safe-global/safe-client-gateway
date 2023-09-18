import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import {
  Portfolio,
  PortfolioAttributes,
  PortfolioPositionsDistributionByType,
} from '../portfolio.entity';

export function portfolioPositionsDistributionByTypeBuilder(): IBuilder<PortfolioPositionsDistributionByType> {
  return Builder.new<PortfolioPositionsDistributionByType>()
    .with('wallet', faker.number.float())
    .with('deposited', faker.number.float())
    .with('borrowed', faker.number.float())
    .with('locked', faker.number.float())
    .with('staked', faker.number.float());
}

export function portfolioPositionsDistributionByChainBuilder(): IBuilder<
  Record<string, number>
> {
  return Builder.new<Record<string, number>>()
    .with('ethereum', faker.number.float())
    .with('optimism', faker.number.float())
    .with('xdai', faker.number.float());
}

export function portfolioAttributesBuilder(): IBuilder<PortfolioAttributes> {
  return Builder.new<PortfolioAttributes>()
    .with(
      'positions_distribution_by_type',
      portfolioPositionsDistributionByTypeBuilder().build(),
    )
    .with(
      'positions_distribution_by_chain',
      portfolioPositionsDistributionByChainBuilder().build(),
    )
    .with('total', { positions: faker.number.float() });
}

export function portfolioBuilder(): IBuilder<Portfolio> {
  return Builder.new<Portfolio>()
    .with('type', 'portfolio')
    .with('id', faker.string.sample())
    .with('attributes', portfolioAttributesBuilder().build());
}
