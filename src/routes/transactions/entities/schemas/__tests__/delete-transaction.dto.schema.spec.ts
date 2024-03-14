import { DeleteTransactionDtoSchema } from '@/routes/transactions/entities/schemas/delete-transaction.dto.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

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

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
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
