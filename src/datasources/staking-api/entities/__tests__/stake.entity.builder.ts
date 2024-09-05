import { Builder, IBuilder } from '@/__tests__/builder';
import { Stake } from '@/datasources/staking-api/entities/stake.entity';
import { faker } from '@faker-js/faker';

export function stakeBuilder(): IBuilder<Stake> {
  return new Builder<Stake>()
    .with(
      'validator_address',
      faker.string.hexadecimal({
        length: 96,
      }) as `0x${string}`,
    )
    .with('state', faker.lorem.words())
    .with('effective_balance', faker.string.numeric())
    .with('rewards', faker.string.numeric());
}
