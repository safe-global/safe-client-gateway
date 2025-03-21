import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { TypedData } from '@/domain/messages/entities/typed-data.entity';

// Note: the following is not strictly typed
export function typedDataBuilder(): IBuilder<TypedData> {
  const primaryType = faker.lorem.word();

  const field1 = faker.lorem.word();
  const field2 = faker.lorem.word();

  return new Builder<TypedData>()
    .with('domain', {
      chainId: faker.number.int(),
      verifyingContract: getAddress(faker.finance.ethereumAddress()),
    })
    .with('primaryType', primaryType)
    .with('types', {
      [primaryType]: [
        {
          name: field1,
          type: 'uint256',
        },
        {
          name: field2,
          type: 'address',
        },
      ],
    })
    .with('message', {
      [field1]: BigInt(faker.number.int()),
      [field2]: getAddress(faker.finance.ethereumAddress()),
    });
}
