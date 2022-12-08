import { faker } from '@faker-js/faker';
import { MasterCopy } from '../master-copies.entity';

export default function (
  address?: string,
  version?: string,
  deployer?: string,
  deployedBlockNumber?: number,
  lastIndexedBlockNumber?: number,
  l2?: boolean,
): MasterCopy {
  return <MasterCopy>{
    address: address ?? faker.finance.ethereumAddress(),
    version: version ?? faker.system.semver(),
    deployer: deployer ?? faker.finance.ethereumAddress(),
    deployedBlockNumber:
      deployedBlockNumber ?? faker.datatype.number({ min: 0 }),
    lastIndexedBlockNumber:
      lastIndexedBlockNumber ?? faker.datatype.number({ min: 0 }),
    l2: l2 ?? faker.datatype.boolean(),
  };
}
