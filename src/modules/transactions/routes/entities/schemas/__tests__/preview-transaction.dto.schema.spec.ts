import { previewTransactionDtoBuilder } from '@/modules/transactions/routes/entities/__tests__/preview-transaction.dto.builder';
import { PreviewTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/preview-transaction.dto.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('PreviewTransactionDtoSchema', () => {
  it('should validate a valid PreviewTransactionDto', () => {
    const previewTransactionDto = previewTransactionDtoBuilder().build();

    const result = PreviewTransactionDtoSchema.safeParse(previewTransactionDto);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['to'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['value'],
      }),
      expect.objectContaining({
        code: 'invalid_value',
        values: [0, 1],
        path: ['operation'],
        message: 'Invalid option: expected one of 0|1',
      }),
    ]);
  });
});
