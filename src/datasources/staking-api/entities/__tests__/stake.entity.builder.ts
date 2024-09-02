import { Builder, IBuilder } from '@/__tests__/builder';
import { Stake } from '@/datasources/staking-api/entities/stake.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function stakeBuilder(): IBuilder<Stake> {
  return new Builder<Stake>()
    .with(
      'validator_address',
      faker.string.hexadecimal({
        length: faker.helpers.rangeToNumber({ min: 40, max: 100 }), // TODO: normalize
      }),
    )
    .with('validator_index', faker.number.int())
    .with('state', faker.lorem.words())
    .with('activated_at', faker.date.recent())
    .with('activated_epoch', faker.number.int())
    .with('delegated_block', faker.number.int())
    .with('delegated_at', faker.date.recent())
    .with('effective_balance', faker.string.numeric())
    .with('balance', faker.string.numeric())
    .with('consensus_rewards', faker.string.numeric())
    .with('execution_rewards', faker.string.numeric())
    .with('rewards', faker.string.numeric())
    .with('gross_apy', faker.number.float())
    .with('deposit_tx_sender', getAddress(faker.finance.ethereumAddress()))
    .with('withdrawal_credentials', faker.lorem.words())
    .with('is_kiln', faker.datatype.boolean())
    .with('activation_eligibility_epoch', faker.number.int())
    .with('activation_eligibility_at', faker.date.recent())
    .with('updated_at', faker.date.recent())
    .with('estimated_next_skimming_slot', faker.number.int())
    .with('estimated_next_skimming_at', faker.date.recent());
}
