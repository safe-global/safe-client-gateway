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
        // @ts-expect-error - enum values cannot be inferred by zod (zod-based error)
        {
          expected: '0 | 1',
          received: 'undefined',
          code: 'invalid_type',
          path: ['operation'],
          message: 'Required',
        },
      ]),
    );
  });
});
