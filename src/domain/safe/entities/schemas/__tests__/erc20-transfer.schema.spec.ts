import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { Erc20TransferSchema } from '@/domain/safe/entities/schemas/erc20-transfer.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('Erc20TransferSchema', () => {
  it('should validate a Erc20Transfer', () => {
    const erc20Transfer = erc20TransferBuilder().build();

    const result = Erc20TransferSchema.safeParse(erc20Transfer);

    expect(result.success).toBe(true);
  });

  it('should coerce the executionDate', () => {
    const executionDate = faker.date.recent();
    const erc20Transfer = erc20TransferBuilder()
      // @ts-expect-error - type reflectes inferred coercion
      .with('executionDate', executionDate.toISOString())
      .build();

    const result = Erc20TransferSchema.safeParse(erc20Transfer);

    expect(result.success && executionDate).toBeInstanceOf(Date);
  });

  it('should not allow non-hex transactionHash values', () => {
    const erc20Transfer = erc20TransferBuilder()
      .with('transactionHash', faker.string.numeric() as `0x${string}`)
      .build();

    const result = Erc20TransferSchema.safeParse(erc20Transfer);

    expect(result.success).toBe(false);
  });

  it.each(['to' as const, 'from' as const, 'tokenAddress' as const])(
    `should checksum the %s`,
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const erc20Transfer = erc20TransferBuilder()
        .with(field, nonChecksummedAddress as `0x${string}`)
        .build();

      const result = Erc20TransferSchema.safeParse(erc20Transfer);

      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );
});
