import { AddConfirmationDtoSchema } from '@/modules/transactions/routes/entities/schemas/add-confirmation.dto.schema';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';

describe('AddConfirmationDtoSchema', () => {
  it('should validate a signature', () => {
    const signature = faker.string.hexadecimal({
      length: 130,
    }) as Address;
    const result = AddConfirmationDtoSchema.safeParse({ signature });

    expect(result.success).toBe(true);
    expect(result.success && 'signature' in result.data).toBe(true);
    expect(result.success && 'signedSafeTxHash' in result.data).toBe(false);
  });

  it('supports the signedSafeTxHash property', () => {
    const signedSafeTxHash = faker.string.hexadecimal({
      length: 130,
    }) as Address;

    const result = AddConfirmationDtoSchema.safeParse({ signedSafeTxHash });

    expect(result.success).toBe(true);
    expect(result.success && 'signature' in result.data).toBe(true);
    expect(result.success && 'signedSafeTxHash' in result.data).toBe(false);
  });

  it('should not validate a non-signature', () => {
    const value = { invalid: 'addConfirmationDto' };
    const result = AddConfirmationDtoSchema.safeParse(value);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_union',
        message: 'Invalid input',
        path: [],
        errors: [
          [
            expect.objectContaining({
              code: 'invalid_type',
              expected: 'string',
              path: ['signature'],
            }),
          ],
          [
            expect.objectContaining({
              code: 'invalid_type',
              expected: 'string',
              path: ['signedSafeTxHash'],
            }),
          ],
        ],
      }),
    ]);
  });
});
