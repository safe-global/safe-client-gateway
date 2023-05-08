import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { NativeTokenTransfer } from '../transfer.entity';

export function nativeTokenTransferBuilder(): IBuilder<NativeTokenTransfer> {
  return Builder.new<NativeTokenTransfer>()
    .with('blockNumber', faker.datatype.number())
    .with('executionDate', faker.date.recent())
    .with('from', faker.finance.ethereumAddress())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.datatype.hexadecimal())
    .with('value', faker.datatype.hexadecimal())
    .with('transferId', faker.datatype.string());
}

export function toJson(nativeTokenTransfer: NativeTokenTransfer): unknown {
  return {
    ...nativeTokenTransfer,
    type: 'ETHER_TRANSFER',
    executionDate: nativeTokenTransfer.executionDate.toISOString(),
  };
}
