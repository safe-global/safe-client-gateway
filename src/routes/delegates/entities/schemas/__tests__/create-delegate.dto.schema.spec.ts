import { createDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/create-delegate.dto.builder';
import { CreateDelegateDtoSchema } from '@/routes/delegates/entities/schemas/create-delegate.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('CreateDelegateSchema', () => {
  it('should validate a valid CreateDelegateDto', () => {
    const createDelegateDto = createDelegateDtoBuilder().build();

    const result = CreateDelegateDtoSchema.safeParse(createDelegateDto);

    expect(result.success).toBe(true);
  });

  it('should checksum safe, delegate and delegator', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const createDelegateDto = createDelegateDtoBuilder()
      .with('safe', nonChecksummedAddress)
      .with('delegate', nonChecksummedAddress)
      .with('delegator', nonChecksummedAddress)
      .build();

    const result = CreateDelegateDtoSchema.safeParse(createDelegateDto);

    expect(result.success && result.data.safe).toBe(
      getAddress(nonChecksummedAddress),
    );
    expect(result.success && result.data.delegate).toBe(
      getAddress(nonChecksummedAddress),
    );
    expect(result.success && result.data.delegator).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow undefined safe', () => {
    const createDelegateDto = createDelegateDtoBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete createDelegateDto.safe;

    const result = CreateDelegateDtoSchema.safeParse(createDelegateDto);

    expect(result.success && result.data.safe).toBe(null);
  });

  it('should not allow invalid CreateDelegateDto objects', () => {
    const createDelegateDto = { invalid: 'createDelegateDto' };

    const result = CreateDelegateDtoSchema.safeParse(createDelegateDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['delegate'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['delegator'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['signature'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['label'],
          message: 'Required',
        },
      ]),
    );
  });
});
