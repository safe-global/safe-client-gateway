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
    expect(result.success && 'signature' in result.data).toBe(true);
    expect(result.success && 'signedSafeTxHash' in result.data).toBe(false);
  });

  it('supports the signedSafeTxHash property', () => {
    const signedSafeTxHash = faker.string.hexadecimal({
      length: 130,
    }) as `0x${string}`;

    const result = AddConfirmationDtoSchema.safeParse({ signedSafeTxHash });

    expect(result.success).toBe(true);
    expect(result.success && 'signature' in result.data).toBe(true);
    expect(result.success && 'signedSafeTxHash' in result.data).toBe(false);
  });

  it('should not validate a non-signature', () => {
    const value = { invalid: 'addConfirmationDto' };
    const result = AddConfirmationDtoSchema.safeParse(value);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_union',
        message: 'Invalid input',
        path: [],
        unionErrors: [
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'undefined',
              path: ['signature'],
              message: 'Required',
            },
          ]),
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'undefined',
              path: ['signedSafeTxHash'],
              message: 'Required',
            },
          ]),
        ],
      },
    ]);
  });
});
