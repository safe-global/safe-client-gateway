import { previewTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/preview-transaction.dto.builder';
import { PreviewTransactionDtoSchema } from '@/routes/transactions/entities/schemas/preview-transaction.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('PreviewTransactionDtoSchema', () => {
  it('should validate a valid PreviewTransactionDto', () => {
    const previewTransactionDto = previewTransactionDtoBuilder().build();

    const result = PreviewTransactionDtoSchema.safeParse(previewTransactionDto);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('to', nonChecksummedAddress)
      .build();

    const result = PreviewTransactionDtoSchema.safeParse(previewTransactionDto);

    expect(result.success && result.data.to).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow optional data, defaulting to null', () => {
    const previewTransactionDto = previewTransactionDtoBuilder().build();
    // @ts-expect-error - inferred type does not allow optional properties
    delete previewTransactionDto.data;

    const result = PreviewTransactionDtoSchema.safeParse(previewTransactionDto);

    expect(result.success && result.data.data).toBe(null);
  });

  it('should not allow and invalid PreviewTransactionDto', () => {
    const previewTransactionDto = {
      invalid: 'previewTransactionDto',
    };

    const result = PreviewTransactionDtoSchema.safeParse(previewTransactionDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['to'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['value'],
          message: 'Required',
        },
        {
          code: 'invalid_union',
          unionErrors: [
            {
              issues: [
                // @ts-expect-error - zod cannot infer literal (zod-based error)
                {
                  code: 'invalid_literal',
                  expected: 0,
                  path: ['operation'],
                  message: 'Invalid literal value, expected 0',
                },
              ],
              name: 'ZodError',
            },
            {
              issues: [
                // @ts-expect-error - zod cannot infer literal (zod-based error)
                {
                  code: 'invalid_literal',
                  expected: 1,
                  path: ['operation'],
                  message: 'Invalid literal value, expected 1',
                },
              ],
              name: 'ZodError',
            },
          ],
          path: ['operation'],
          message: 'Invalid input',
        },
      ]),
    );
  });
});
