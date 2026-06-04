// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Singleton } from '@/modules/chains/domain/entities/singleton.entity';

export function singletonBuilder(): IBuilder<Singleton> {
  return new Builder<Singleton>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('version', faker.system.semver())
    .with('deployer', getAddress(faker.finance.ethereumAddress()))
    .with('deployedBlockNumber', faker.number.int())
    .with('lastIndexedBlockNumber', faker.number.int())
    .with('l2', faker.datatype.boolean());
}
