import { deleteDelegateDtoBuilder } from '@/modules/delegate/routes/entities/__tests__/delete-delegate.dto.builder';
import { DeleteDelegateDtoSchema } from '@/modules/delegate/routes/entities/schemas/delete-delegate.dto.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('DeleteDelegateSchema', () => {
  it('should validate a valid DeleteDelegateDto', () => {
    const deleteDelegateDto = deleteDelegateDtoBuilder().build();

    const result = DeleteDelegateDtoSchema.safeParse(deleteDelegateDto);

    expect(result.success).toBe(true);
  });

  it('should checksum delegate and delegator', () => {
    const nonCheckSummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
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

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['delegate'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['delegator'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['signature'],
      },
    ]);
  });
});
