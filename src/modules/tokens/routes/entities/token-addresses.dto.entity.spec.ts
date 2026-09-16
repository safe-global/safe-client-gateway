// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  MAX_TOKEN_ADDRESSES,
  TokenAddressesSchema,
} from '@/modules/tokens/routes/entities/token-addresses.dto.entity';

describe('TokenAddressesSchema', () => {
  it('splits a comma-separated list into checksummed addresses, preserving order', () => {
    const addresses = Array.from({ length: 3 }, () =>
      getAddress(faker.finance.ethereumAddress()),
    );

    const result = TokenAddressesSchema.safeParse(addresses.join(','));

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(addresses);
  });

  it('checksums lower-case input and trims whitespace around entries', () => {
    const address = getAddress(faker.finance.ethereumAddress());

    const result = TokenAddressesSchema.safeParse(
      ` ${address.toLowerCase()} , ${address} `,
    );

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual([address, address]);
  });

  it("keeps duplicates (de-duplication is the service's job)", () => {
    const address = getAddress(faker.finance.ethereumAddress());

    const result = TokenAddressesSchema.safeParse(`${address},${address}`);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('rejects an empty list', () => {
    expect(TokenAddressesSchema.safeParse('').success).toBe(false);
    expect(TokenAddressesSchema.safeParse(' , ').success).toBe(false);
  });

  it(`rejects more than ${MAX_TOKEN_ADDRESSES} addresses`, () => {
    const addresses = Array.from({ length: MAX_TOKEN_ADDRESSES + 1 }, () =>
      getAddress(faker.finance.ethereumAddress()),
    );

    expect(TokenAddressesSchema.safeParse(addresses.join(',')).success).toBe(
      false,
    );
  });

  it(`accepts exactly ${MAX_TOKEN_ADDRESSES} addresses`, () => {
    const addresses = Array.from({ length: MAX_TOKEN_ADDRESSES }, () =>
      getAddress(faker.finance.ethereumAddress()),
    );

    expect(TokenAddressesSchema.safeParse(addresses.join(',')).success).toBe(
      true,
    );
  });

  it('rejects a malformed address anywhere in the list', () => {
    const address = getAddress(faker.finance.ethereumAddress());

    const result = TokenAddressesSchema.safeParse(
      `${address},0xnot-an-address`,
    );

    expect(result.success).toBe(false);
  });
});
