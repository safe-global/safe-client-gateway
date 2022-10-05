import { faker } from '@faker-js/faker';
import { Contract } from '../contract.entity';

export default function (
  address?: string,
  name?: string,
  displayName?: string,
  logoUri?: string,
  contractAbi?: object,
  trustedForDelegateCall?: boolean,
): Contract {
  return <Contract>{
    address: address ?? faker.finance.ethereumAddress(),
    name: name ?? faker.random.word(),
    displayName: displayName ?? faker.random.words(),
    logoUri: logoUri ?? faker.internet.url(),
    contractAbi: contractAbi ?? JSON.parse(faker.datatype.json()),
    trustedForDelegateCall: trustedForDelegateCall ?? faker.datatype.boolean(),
  };
}
