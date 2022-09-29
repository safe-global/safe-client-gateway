import { Safe } from '../safe.entity';
import { faker } from '@faker-js/faker';

export default function (
  address?: string,
  nonce?: number,
  threshold?: number,
  owners?: string[],
  masterCopy?: string,
  modules?: string[],
  fallbackHandler?: string,
  guard?: string,
  version?: string,
): Safe {
  return <Safe>{
    address: address ?? faker.finance.ethereumAddress(),
    nonce: nonce ?? faker.datatype.number(),
    threshold: threshold ?? faker.datatype.number(),
    owners: owners ?? [faker.finance.ethereumAddress()],
    masterCopy: masterCopy ?? faker.finance.ethereumAddress(),
    modules: modules ?? undefined,
    fallbackHandler: fallbackHandler ?? faker.finance.ethereumAddress(),
    guard: guard ?? faker.finance.ethereumAddress(),
    version: version ?? faker.system.semver(),
  };
}
