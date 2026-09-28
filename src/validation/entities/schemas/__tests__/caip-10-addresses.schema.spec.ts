// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';
import {
  Caip10AddressesSchema,
  Caip10AddressSchema,
} from '@/validation/entities/schemas/caip-10-addresses.schema';

describe('Caip10AddressSchema', () => {
  it('should split a chain id and a checksummed address', () => {
    const chainId = faker.string.numeric({ length: 3 });
    const address = getAddress(faker.finance.ethereumAddress());

    expect(Caip10AddressSchema.parse(`${chainId}:${address}`)).toStrictEqual({
      chainId,
      address,
    });
  });

  it('should checksum a lower-cased address', () => {
    const address = faker.finance.ethereumAddress().toLowerCase();

    expect(Caip10AddressSchema.parse(`1:${address}`)).toStrictEqual({
      chainId: '1',
      address: getAddress(address),
    });
  });

  it.each([
    ['no separator', '1'],
    ['an empty chain id', `:${getAddress(faker.finance.ethereumAddress())}`],
    ['an empty address', '1:'],
    [
      'a non numeric chain id',
      `mainnet:${getAddress(faker.finance.ethereumAddress())}`,
    ],
    [
      'a hexadecimal chain id',
      `${faker.string.hexadecimal()}:${getAddress(faker.finance.ethereumAddress())}`,
    ],
    ['an invalid address', '1:0x123'],
    [
      'too many separators',
      `1:${getAddress(faker.finance.ethereumAddress())}:2`,
    ],
    [
      'a chain id longer than allowed',
      `${'1'.repeat(CHAIN_ID_MAXLENGTH + 1)}:${getAddress(faker.finance.ethereumAddress())}`,
    ],
  ])('should not validate %s', (_, value) => {
    expect(Caip10AddressSchema.safeParse(value).success).toBe(false);
  });

  it('should point at the part of the address that is wrong', () => {
    const result = Caip10AddressSchema.safeParse(
      `mainnet:${getAddress(faker.finance.ethereumAddress())}`,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: ['chainId'],
      },
    ]);
  });
});

describe('Caip10AddressesSchema', () => {
  const safes = faker.helpers.multiple(
    () => ({
      chainId: faker.string.numeric({ length: { min: 1, max: 6 } }),
      address: getAddress(faker.finance.ethereumAddress()),
    }),
    { count: { min: 1, max: 5 } },
  );

  it('should parse a comma-separated list', () => {
    const value = safes
      .map(({ chainId, address }) => `${chainId}:${address}`)
      .join(',');

    expect(Caip10AddressesSchema.parse(value)).toStrictEqual(safes);
  });

  it('should checksum every address', () => {
    const value = safes
      .map(({ chainId, address }) => `${chainId}:${address.toLowerCase()}`)
      .join(',');

    expect(Caip10AddressesSchema.parse(value)).toStrictEqual(safes);
  });

  it.each([
    ['an empty list', ''],
    [
      'a trailing separator',
      `1:${getAddress(faker.finance.ethereumAddress())},`,
    ],
    [
      'one malformed entry',
      `1:${getAddress(faker.finance.ethereumAddress())},mainnet:0x123`,
    ],
  ])('should not validate %s', (_, value) => {
    expect(Caip10AddressesSchema.safeParse(value).success).toBe(false);
  });
});
