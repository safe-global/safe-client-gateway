import { Caip10AddressesSchema } from '@/routes/safes/entities/caip-10-addresses.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('Caip10AddressesSchema', () => {
  const caip10Addresses = faker.helpers.multiple(
    () => {
      return {
        chainId: faker.string.numeric(),
        address: faker.finance.ethereumAddress(),
      };
    },
    {
      count: { min: 1, max: 5 },
    },
  );

  it('should parse CAIP-10 addresses', () => {
    const caip10AddressesString = caip10Addresses
      .map((address) => `${address.chainId}:${address.address}`)
      .join(',');

    const result = Caip10AddressesSchema.safeParse(caip10AddressesString);

    expect(result.success).toBe(true);
  });

  it('should checksum addresses', () => {
    const caip10AddressesString = caip10Addresses
      .map((address) => `${address.chainId}:${address.address}`)
      .join(',');

    const result = Caip10AddressesSchema.safeParse(caip10AddressesString);

    expect(
      result.success && result.data.map(({ address }) => address),
    ).toStrictEqual(
      caip10Addresses.map(({ address }) => {
        return getAddress(address);
      }),
    );
  });

  it('should throw for incorrectly formatted CAIP-10 addresses', () => {
    const caip10AddressesString = caip10Addresses
      .map((address) => `${address.chainId}-${address.address}`)
      .join(',');

    const result = Caip10AddressesSchema.safeParse(caip10AddressesString);

    expect(!result.success && result.error.issues).toStrictEqual(
      Array.from({ length: caip10Addresses.length }).flatMap(() => [
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['chainId'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['address'],
          received: 'undefined',
        },
      ]),
    );
  });

  it('should throw for non-numerical chainIds', () => {
    const caip10AddressesString = caip10Addresses
      .map((address) => `${faker.string.hexadecimal()}:${address.address}`)
      .join(',');

    const result = Caip10AddressesSchema.safeParse(caip10AddressesString);

    expect(!result.success && result.error.issues).toStrictEqual(
      Array.from({ length: caip10Addresses.length }).map(() => ({
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: ['chainId'],
      })),
    );
  });

  it('should throw for invalid addresses', () => {
    const caip10AddressesString = caip10Addresses
      .map((address) => `${address.chainId}:${faker.string.numeric()}`)
      .join(',');

    const result = Caip10AddressesSchema.safeParse(caip10AddressesString);

    expect(!result.success && result.error.issues).toStrictEqual(
      Array.from({ length: caip10Addresses.length }).flatMap(() => [
        {
          code: 'custom',
          message: 'Invalid address',
          path: ['address'],
        },
      ]),
    );
  });

  it('should throw for missing chainIds', () => {
    const caip10AddressesString = caip10Addresses
      .map((address) => `:${address.address}`)
      .join(',');

    const result = Caip10AddressesSchema.safeParse(caip10AddressesString);

    expect(!result.success && result.error.issues).toStrictEqual(
      Array.from({ length: caip10Addresses.length }).flatMap(() => [
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['chainId'],
        },
      ]),
    );
  });

  it('should throw for missing addresses', () => {
    const caip10AddressesString = caip10Addresses
      .map((address) => `${address.chainId}:`)
      .join(',');

    const result = Caip10AddressesSchema.safeParse(caip10AddressesString);

    expect(!result.success && result.error.issues).toStrictEqual(
      Array.from({ length: caip10Addresses.length }).flatMap(() => [
        {
          code: 'custom',
          message: 'Invalid address',
          path: ['address'],
        },
      ]),
    );
  });
});
