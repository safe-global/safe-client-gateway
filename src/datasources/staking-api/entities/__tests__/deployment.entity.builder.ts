import { Builder, IBuilder } from '@/__tests__/builder';
import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function deploymentBuilder(): IBuilder<Deployment> {
  return new Builder<Deployment>()
    .with('id', faker.string.uuid())
    .with('organization_id', faker.string.uuid())
    .with(
      'product_type',
      faker.helpers.arrayElement(['defi', 'pooling', 'dedicated']),
    )
    .with('name', faker.lorem.words())
    .with('display_name', faker.lorem.words())
    .with('description', faker.lorem.words())
    .with('chain', faker.helpers.arrayElement(['eth', 'bsc']))
    .with('chain_id', faker.number.int())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('status', faker.helpers.arrayElement(['active']))
    .with('product_fee', faker.string.numeric());
}
