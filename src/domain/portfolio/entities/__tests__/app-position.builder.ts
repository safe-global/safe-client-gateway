import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AppPosition } from '@/domain/portfolio/entities/app-position.entity';
import { appPositionTokenInfoBuilder } from '@/domain/portfolio/entities/__tests__/app-position-token-info.builder';

export function appPositionBuilder(): IBuilder<AppPosition> {
  return new Builder<AppPosition>()
    .with('key', faker.string.alphanumeric(16))
    .with(
      'type',
      faker.helpers.arrayElement([
        'app-token',
        'contract-position',
        'lending',
        'staking',
        'vault',
      ]),
    )
    .with('name', faker.word.words(2))
    .with('tokenInfo', appPositionTokenInfoBuilder().build())
    .with('balance', faker.string.numeric({ length: 18 }))
    .with(
      'balanceFiat',
      faker.number.float({ min: 0, max: 100000, fractionDigits: 2 }),
    )
    .with(
      'priceChangePercentage1d',
      faker.number.float({ min: -50, max: 50, fractionDigits: 2 }),
    );
}
