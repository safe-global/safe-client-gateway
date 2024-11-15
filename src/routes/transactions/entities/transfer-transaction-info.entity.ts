import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { Transfer } from '@/routes/transactions/entities/transfers/transfer.entity';
import { Erc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '@/routes/transactions/entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '@/routes/transactions/entities/transfers/native-coin-transfer.entity';

export enum TransferDirection {
  Incoming = 'INCOMING',
  Outgoing = 'OUTGOING',
  Unknown = 'UNKNOWN',
}

@ApiExtraModels(Erc20Transfer, Erc721Transfer, NativeCoinTransfer)
export class TransferTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.Transfer] })
  override type = TransactionInfoType.Transfer;
  @ApiProperty()
  sender: AddressInfo;
  @ApiProperty()
  recipient: AddressInfo;
  @ApiProperty({ enum: TransferDirection })
  direction: TransferDirection;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(Erc20Transfer) },
      { $ref: getSchemaPath(Erc721Transfer) },
      { $ref: getSchemaPath(NativeCoinTransfer) },
    ],
  })
  transferInfo: Transfer;

  constructor(
    sender: AddressInfo,
    recipient: AddressInfo,
    direction: TransferDirection,
    transferInfo: Transfer,
    humanDescription: string | null,
  ) {
    super(TransactionInfoType.Transfer, humanDescription);
    this.sender = sender;
    this.recipient = recipient;
    this.direction = direction;
    this.transferInfo = transferInfo;
  }
}

export function isTransferTransactionInfo(
  txInfo: TransactionInfo,
): txInfo is TransferTransactionInfo {
  return txInfo.type === TransactionInfoType.Transfer;
}
