import { faker } from '@faker-js/faker';
import { MasterCopy } from '../master-copies.entity';
import { Builder, IBuilder } from '@/__tests__/builder';

export function masterCopyBuilder(): IBuilder<MasterCopy> {
  return Builder.new<MasterCopy>()
    .with('address', faker.finance.ethereumAddress())
    .with('version', faker.system.semver())
    .with('deployer', faker.finance.ethereumAddress())
    .with('deployedBlockNumber', faker.number.int())
    .with('lastIndexedBlockNumber', faker.number.int())
    .with('l2', faker.datatype.boolean());
}
