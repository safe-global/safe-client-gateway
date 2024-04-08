import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { NativeTokenTransfer } from '@/domain/safe/entities/transfer.entity';
import { getAddress } from 'viem';

export function nativeTokenTransferBuilder(): IBuilder<NativeTokenTransfer> {
  return new Builder<NativeTokenTransfer>()
    .with('type', 'ETHER_TRANSFER')
    .with('blockNumber', faker.number.int())
    .with('executionDate', faker.date.recent())
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('transactionHash', faker.string.hexadecimal() as `0x${string}`)
    .with('value', faker.string.hexadecimal())
    .with('transferId', faker.string.sample());
}

export function toJson(nativeTokenTransfer: NativeTokenTransfer): unknown {
  return {
    ...nativeTokenTransfer,
    executionDate: nativeTokenTransfer.executionDate.toISOString(),
  };
}
