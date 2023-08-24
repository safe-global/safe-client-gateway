import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionInfo } from './transaction-info.entity';

export class CreationTransactionInfo extends TransactionInfo {
  @ApiProperty()
  creator: AddressInfo;
  @ApiProperty()
  transactionHash: string;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  implementation: AddressInfo | null;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  factory: AddressInfo | null;

  constructor(
    creator: AddressInfo,
    transactionHash: string,
    implementation: AddressInfo | null,
    factory: AddressInfo | null,
  ) {
    super('Creation', null);
    this.creator = creator;
    this.transactionHash = transactionHash;
    this.implementation = implementation;
    this.factory = factory;
  }
}
