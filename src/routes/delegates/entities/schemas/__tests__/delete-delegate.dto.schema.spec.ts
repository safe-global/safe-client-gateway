import { deleteDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/delete-delegate.dto.builder';
import { DeleteDelegateDtoSchema } from '@/routes/delegates/entities/schemas/delete-delegate.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('DeleteDelegateSchema', () => {
  it('should validate a valid DeleteDelegateDto', () => {
    const deleteDelegateDto = deleteDelegateDtoBuilder().build();

    const result = DeleteDelegateDtoSchema.safeParse(deleteDelegateDto);

    expect(result.success).toBe(true);
  });

  it('should checksum delegate and delegator', () => {
    const nonCheckSummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const deleteDelegateDto = deleteDelegateDtoBuilder()
      .with('delegate', nonCheckSummedAddress)
      .with('delegator', nonCheckSummedAddress)
      .build();

    const result = DeleteDelegateDtoSchema.safeParse(deleteDelegateDto);

    expect(result.success && result.data.delegate).toBe(
      getAddress(nonCheckSummedAddress),
    );
    expect(result.success && result.data.delegator).toBe(
      getAddress(nonCheckSummedAddress),
    );
  });

  it('should not allow invalid DeleteDelegateDto objects', () => {
    const deleteDelegateDto = { invalid: 'deleteDelegateDto' };

    const result = DeleteDelegateDtoSchema.safeParse(deleteDelegateDto);

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
      ]),
    );
  });
});
