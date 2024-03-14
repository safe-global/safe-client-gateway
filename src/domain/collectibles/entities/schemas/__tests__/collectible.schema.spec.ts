import { collectibleBuilder } from '@/domain/collectibles/entities/__tests__/collectible.builder';
import { CollectibleSchema } from '@/domain/collectibles/entities/schemas/collectible.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('CollectibleSchema', () => {
  it('should validate a valid collectible', () => {
    const collectible = collectibleBuilder().build();

    const result = CollectibleSchema.safeParse(collectible);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
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

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['address'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['tokenName'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['tokenSymbol'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['logoUri'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['id'],
          message: 'Required',
        },
      ]),
    );
  });
});
