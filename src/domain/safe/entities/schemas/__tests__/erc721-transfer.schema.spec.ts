import { erc721TransferBuilder } from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { Erc721TransferSchema } from '@/domain/safe/entities/schemas/erc721-transfer.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('Erc721TransferSchema', () => {
  it('should validate a Erc721Transfer', () => {
    const erc721Transfer = erc721TransferBuilder().build();

    const result = Erc721TransferSchema.safeParse(erc721Transfer);

    expect(result.success).toBe(true);
  });

  it('should coerce the executionDate', () => {
    const executionDate = faker.date.recent();
    const erc721Transfer = erc721TransferBuilder()
      // @ts-expect-error - type reflectes inferred coercion
      .with('executionDate', executionDate.toISOString())
      .build();

    const result = Erc721TransferSchema.safeParse(erc721Transfer);

    expect(result.success && executionDate).toBeInstanceOf(Date);
  });

  it('should not allow non-hex transactionHash values', () => {
    const erc721Transfer = erc721TransferBuilder()
      .with('transactionHash', faker.string.numeric() as `0x${string}`)
      .build();

    const result = Erc721TransferSchema.safeParse(erc721Transfer);

    expect(result.success).toBe(false);
  });

  it.each(['to' as const, 'from' as const, 'tokenAddress' as const])(
    `should checksum the %s`,
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const erc20Transfer = erc721TransferBuilder()
        .with(field, nonChecksummedAddress as `0x${string}`)
        .build();

      const result = Erc721TransferSchema.safeParse(erc20Transfer);

      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it('should allow an undefined tokenAddress', () => {
    const erc721Transfer = erc721TransferBuilder().build();
    // @ts-expect-error - type reflectes inferred coercion
    delete erc721Transfer.tokenAddress;

    const result = Erc721TransferSchema.safeParse(erc721Transfer);

    expect(result.success).toBe(true);
  });
});
