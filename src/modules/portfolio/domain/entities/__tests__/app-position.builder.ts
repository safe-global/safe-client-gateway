import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AppPosition } from '@/modules/portfolio/domain/entities/app-position.entity';
import { getAddress } from 'viem';
import { tokenInfoBuilder } from '@/modules/portfolio/domain/entities/__tests__/token-info.builder';

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
    .with(
      'groupId',
      faker.datatype.boolean() ? faker.string.alphanumeric(32) : undefined,
    )
    .with('tokenInfo', tokenInfoBuilder().build())
    .with(
      'receiptTokenAddress',
      faker.datatype.boolean()
        ? getAddress(faker.finance.ethereumAddress())
        : undefined,
    )
    .with('balance', faker.string.numeric({ length: 18 }))
    .with(
      'balanceFiat',
      faker.number.float({ min: 0, max: 100000, fractionDigits: 2 }).toString(),
    )
    .with(
      'priceChangePercentage1d',
      faker.number.float({ min: -50, max: 50, fractionDigits: 2 }).toString(),
    );
}
