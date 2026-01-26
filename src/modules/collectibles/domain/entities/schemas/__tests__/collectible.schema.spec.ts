import { collectibleBuilder } from '@/modules/collectibles/domain/entities/__tests__/collectible.builder';
import { CollectibleSchema } from '@/modules/collectibles/domain/entities/schemas/collectible.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('CollectibleSchema', () => {
  it('should validate a valid collectible', () => {
    const collectible = collectibleBuilder().build();

    const result = CollectibleSchema.safeParse(collectible);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
    const collectible = collectibleBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = CollectibleSchema.safeParse(collectible);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow undefined uri, name, description, imageUri and metadata', () => {
    const fields = [
      'uri',
      'name',
      'description',
      'imageUri',
      'metadata',
    ] as const;
    const collectible = collectibleBuilder().build();
    fields.forEach((field) => {
      delete collectible[field];
    });

    const result = CollectibleSchema.safeParse(collectible);

    fields.forEach((field) => {
      expect(result.success && result.data[field]).toBe(null);
    });
  });

  it('should now validate an invalid collectible', () => {
    const collectible = { invalid: 'collectible' };

    const result = CollectibleSchema.safeParse(collectible);

    expect(!result.success && result.error?.issues).toEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['address'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['tokenName'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['tokenSymbol'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['logoUri'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['id'],
      },
    ]);
  });
});
