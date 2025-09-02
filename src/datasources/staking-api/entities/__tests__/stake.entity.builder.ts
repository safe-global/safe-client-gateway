import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Stake } from '@/datasources/staking-api/entities/stake.entity';
import { StakeState } from '@/datasources/staking-api/entities/stake.entity';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';

export function stakeBuilder(): IBuilder<Stake> {
  return new Builder<Stake>()
    .with(
      'validator_address',
      faker.string.hexadecimal({
        length: KilnDecoder.KilnPublicKeyLength,
      }) as Address,
    )
    .with('state', faker.helpers.arrayElement(Object.values(StakeState)))
    .with('rewards', faker.string.numeric())
    .with('net_claimable_consensus_rewards', faker.string.numeric());
}
