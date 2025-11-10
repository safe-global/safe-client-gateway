import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { TokenBalance } from '@/modules/portfolio/domain/entities/token-balance.entity';
import { tokenInfoBuilder } from '@/modules/portfolio/domain/entities/__tests__/token-info.builder';

export function tokenBalanceBuilder(): IBuilder<TokenBalance> {
  return new Builder<TokenBalance>()
    .with('tokenInfo', tokenInfoBuilder().build())
    .with('balance', faker.string.numeric({ length: 18 }))
    .with(
      'balanceFiat',
      faker.number.float({ min: 0, max: 100000, fractionDigits: 2 }).toString(),
    )
    .with(
      'price',
      faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }).toString(),
    )
    .with(
      'priceChangePercentage1d',
      faker.number.float({ min: -50, max: 50, fractionDigits: 2 }).toString(),
    );
}
