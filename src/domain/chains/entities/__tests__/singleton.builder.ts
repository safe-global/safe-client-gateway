import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Singleton } from '@/domain/chains/entities/singleton.entity';

export function singletonBuilder(): IBuilder<Singleton> {
  return new Builder<Singleton>()
    .with('address', faker.finance.ethereumAddress())
    .with('version', faker.system.semver())
    .with('deployer', faker.finance.ethereumAddress())
    .with('deployedBlockNumber', faker.number.int())
    .with('lastIndexedBlockNumber', faker.number.int())
    .with('l2', faker.datatype.boolean());
}
