// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { SafeIdSchema } from '@/modules/policies/routes/entities/safe-id.entity';

describe('SafeIdSchema', () => {
  it('should split a chain id and a checksummed address', () => {
    const chainId = faker.string.numeric({ length: 3 });
    const address = getAddress(faker.finance.ethereumAddress());

    expect(SafeIdSchema.parse(`${chainId}:${address}`)).toStrictEqual({
      chainId,
      address,
    });
  });

  it('should checksum a lower-cased address', () => {
    const address = faker.finance.ethereumAddress().toLowerCase();

    expect(SafeIdSchema.parse(`1:${address}`)).toStrictEqual({
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
    ['an invalid address', '1:0x123'],
    [
      'too many separators',
      `1:${getAddress(faker.finance.ethereumAddress())}:2`,
    ],
    [
      'a chain id longer than allowed',
      `${'1'.repeat(79)}:${getAddress(faker.finance.ethereumAddress())}`,
    ],
  ])('should not validate %s', (_, value) => {
    expect(SafeIdSchema.safeParse(value).success).toBe(false);
  });
});
