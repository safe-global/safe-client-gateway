import { sample } from 'lodash';
import { Builder, IBuilder } from '@/__tests__/builder';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import {
  TransferDirection,
  TransferTransactionInfo,
} from '../transfer-transaction-info.entity';

export function transferTransactionInfoBuilder(): IBuilder<TransferTransactionInfo> {
  return Builder.new<TransferTransactionInfo>()
    .with('type', 'Transfer')
    .with('sender', addressInfoBuilder().build())
    .with('recipient', addressInfoBuilder().build())
    .with(
      'direction',
      sample(Object.values(TransferDirection)) ?? TransferDirection.Incoming,
    )
    .with('transferInfo', {
      ...erc20TransferBuilder().build(),
      type: 'ERC20_TRANSFER',
    });
}
