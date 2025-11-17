import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Deployment } from '@/modules/staking/datasources/entities/deployment.entity';
import {
  DeploymentChains,
  DeploymentProductTypes,
  DeploymentStatuses,
} from '@/modules/staking/datasources/entities/deployment.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function deploymentBuilder(): IBuilder<Deployment> {
  return new Builder<Deployment>()
    .with('id', faker.string.uuid())
    .with('organization_id', faker.string.uuid())
    .with('product_type', faker.helpers.arrayElement(DeploymentProductTypes))
    .with('name', faker.lorem.words())
    .with('display_name', faker.lorem.words())
    .with('description', faker.lorem.words())
    .with('chain', faker.helpers.arrayElement(DeploymentChains))
    .with('chain_id', faker.number.int())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('status', faker.helpers.arrayElement(DeploymentStatuses))
    .with('external_links', { deposit_url: faker.internet.url() });
}
