import { nativeTokenTransferBuilder } from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { NativeTokenTransferSchema } from '@/domain/safe/entities/schemas/native-token-transfer.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('NativeTokenTransferSchema', () => {
  it('should validate a NativeTokenTransfer', () => {
    const nativeTokenTransfer = nativeTokenTransferBuilder().build();

    const result = NativeTokenTransferSchema.safeParse(nativeTokenTransfer);

    expect(result.success).toBe(true);
  });

  it('should coerce the executionDate', () => {
    const executionDate = faker.date.recent();
    const nativeTokenTransfer = nativeTokenTransferBuilder()
      // @ts-expect-error - type reflectes inferred coercion
      .with('executionDate', executionDate.toISOString())
      .build();

    const result = NativeTokenTransferSchema.safeParse(nativeTokenTransfer);

    expect(result.success && executionDate).toBeInstanceOf(Date);
  });

  it('should not allow non-hex transactionHash values', () => {
    const nativeTokenTransfer = nativeTokenTransferBuilder()
      .with('transactionHash', faker.string.numeric() as `0x${string}`)
      .build();

    const result = NativeTokenTransferSchema.safeParse(nativeTokenTransfer);

    expect(result.success).toBe(false);
  });

  it.each(['to' as const, 'from' as const])(
    `should checksum the %s`,
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const nativeTokenTransfer = nativeTokenTransferBuilder()
        .with(field, nonChecksummedAddress as `0x${string}`)
        .build();

      const result = NativeTokenTransferSchema.safeParse(nativeTokenTransfer);

      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it('should allow an undefined tokenAddress', () => {
    const nativeTokenTransfer = nativeTokenTransferBuilder().build();
    // @ts-expect-error - type reflectes inferred coercion
    delete nativeTokenTransfer.tokenAddress;

    const result = NativeTokenTransferSchema.safeParse(nativeTokenTransfer);

    expect(result.success).toBe(true);
  });
});
