import { AddConfirmationDtoSchema } from '@/routes/transactions/entities/schemas/add-confirmation.dto.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('AddConfirmationDtoSchema', () => {
  it('should validate a signature', () => {
    const signature = faker.string.hexadecimal({
      length: 130,
    }) as `0x${string}`;
    const result = AddConfirmationDtoSchema.safeParse({ signature });

    expect(result.success).toBe(true);
  });

  it('should not validate a non-signature', () => {
    const value = faker.number.int();
    const result = AddConfirmationDtoSchema.safeParse(value);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'number',
          path: [],
          message: 'Expected object, received number',
        },
      ]),
    );
  });
});
