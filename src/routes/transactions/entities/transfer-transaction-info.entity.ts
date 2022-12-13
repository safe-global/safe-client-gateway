import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionInfo } from './transaction-info.entity';
import { Transfer } from './transfers/transfer.entity';

export enum TransferDirection {
  Incoming,
  Outgoing,
  Unknown,
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
  ) {
    super('Transfer');
    this.sender = sender;
    this.recipient = recipient;
    this.direction = direction;
    this.transferInfo = transferInfo;
  }
}
