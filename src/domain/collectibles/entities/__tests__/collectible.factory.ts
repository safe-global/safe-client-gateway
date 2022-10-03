import { Collectible } from '../collectible.entity';
import { faker } from '@faker-js/faker';

export default function (
  address?: string,
  tokenName?: string,
  tokenSymbol?: string,
  logoUri?: string,
  id?: string,
  uri?: string,
  name?: string,
  description?: string,
  imageUri?: string,
  metadata?: Record<string, any>,
): Collectible {
  return <Collectible>{
    address: address ?? faker.finance.ethereumAddress(),
    tokenName: tokenName ?? faker.company.name(),
    tokenSymbol: tokenSymbol ?? faker.finance.currencySymbol(),
    logoUri: logoUri ?? faker.internet.url(),
    id: id ?? faker.datatype.uuid(),
    uri: uri ?? faker.internet.url(),
    name: name ?? faker.company.name(),
    description: description ?? faker.random.words(),
    imageUri: imageUri ?? faker.internet.url(),
    metadata: metadata ?? {},
  };
}
