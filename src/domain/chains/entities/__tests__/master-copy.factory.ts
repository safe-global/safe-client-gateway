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
    address: address ?? faker.random.word(),
    version: version ?? faker.random.word(),
    deployer: deployer ?? faker.random.word(),
    deployedBlockNumber: deployedBlockNumber ?? 10,
    lastIndexedBlockNumber: lastIndexedBlockNumber ?? 11,
    l2: l2 ?? false,
  };
}
