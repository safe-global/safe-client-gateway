import { DeleteTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/delete-transaction.dto.schema';
import { faker } from '@faker-js/faker';

describe('DeleteTransactionDtoSchema', () => {
  it('should validate a valid DeleteTransactionDto', () => {
    const deleteTransactionDto = {
      signature: faker.string.hexadecimal(),
    };

    const result = DeleteTransactionDtoSchema.safeParse(deleteTransactionDto);

    expect(result.success).toBe(true);
  });

  it('should not allow and invalid DeleteTransactionDto', () => {
    const deleteTransactionDto = {
      invalid: 'deleteTransactionDto',
    };

    const result = DeleteTransactionDtoSchema.safeParse(deleteTransactionDto);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['signature'],
      }),
    ]);
  });
});
