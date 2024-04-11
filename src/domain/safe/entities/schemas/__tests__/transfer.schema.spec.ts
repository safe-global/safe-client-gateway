import { fakeJson } from '@/__tests__/faker';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { erc721TransferBuilder } from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { nativeTokenTransferBuilder } from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { TransferSchema } from '@/domain/safe/entities/transfer.entity';

describe('TransferSchema', () => {
  it.each([
    ['NativeTokenTransfer', nativeTokenTransferBuilder().build()],
    ['Erc20Transfer', erc20TransferBuilder().build()],
    ['Erc721Transfer', erc721TransferBuilder().build()],
  ])('should allow %s', (name, transfer) => {
    const result = TransferSchema.safeParse(transfer);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid transfer type', () => {
    const unknownTransfer = fakeJson();

    const result = TransferSchema.safeParse(unknownTransfer);

    expect(result.success).toBe(false);
  });
});
