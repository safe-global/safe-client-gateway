// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { gasTokenBuilder } from '@/modules/fees/domain/entities/__tests__/gas-token.builder';
import { GasTokenSchema } from '@/modules/fees/domain/entities/schemas/gas-token.schema';

describe('GasTokenSchema', () => {
  it('should validate a valid gas token', () => {
    const gasToken = gasTokenBuilder().build();

    const result = GasTokenSchema.safeParse(gasToken);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummed = faker.finance.ethereumAddress().toLowerCase();
    const gasToken = gasTokenBuilder()
      .with('address', nonChecksummed as `0x${string}`)
      .build();

    const result = GasTokenSchema.safeParse(gasToken);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummed),
    );
  });

  it('should not validate an invalid address', () => {
    const gasToken = gasTokenBuilder()
      .with('address', 'invalid' as `0x${string}`)
      .build();

    const result = GasTokenSchema.safeParse(gasToken);

    expect(!result.success && result.error.issues[0]).toMatchObject({
      code: 'custom',
      message: 'Invalid address',
      path: ['address'],
    });
  });

  it('should not validate a missing symbol', () => {
    const { address } = gasTokenBuilder().build();

    const result = GasTokenSchema.safeParse({ address });

    expect(!result.success && result.error.issues[0]).toMatchObject({
      code: 'invalid_type',
      path: ['symbol'],
    });
  });
});
