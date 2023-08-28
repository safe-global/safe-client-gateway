import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionInfo } from './transaction-info.entity';
import { Transfer } from './transfers/transfer.entity';

export enum TransferDirection {
  Incoming = 'INCOMING',
  Outgoing = 'OUTGOING',
  Unknown = 'UNKNOWN',
}

export class TransferTransactionInfo extends TransactionInfo {
  @ApiProperty()
  sender: AddressInfo;
  @ApiProperty()
  recipient: AddressInfo;
  @ApiProperty()
  direction: string;
  @ApiProperty()
  transferInfo: Transfer;

  constructor(
    sender: AddressInfo,
    recipient: AddressInfo,
    direction: string,
    transferInfo: Transfer,
    humanDescription: string | null,
  ) {
    super('Transfer', humanDescription);
    this.sender = sender;
    this.recipient = recipient;
    this.direction = direction;
    this.transferInfo = transferInfo;
  }
}
