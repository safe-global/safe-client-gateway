import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { MessageConfirmation } from './message-confirmation.entity';

export enum MessageStatus {
  NeedsConfirmation = 'NEEDS_CONFIRMATION',
  Confirmed = 'CONFIRMED',
}

export class Message {
  @ApiProperty()
  messageHash: string;
  @ApiProperty()
  status: MessageStatus;
  @ApiPropertyOptional()
  logoUri: string | null;
  @ApiPropertyOptional()
  name: string | null;
  @ApiProperty()
  message: string | unknown;
  @ApiProperty()
  creationTimestamp: number;
  @ApiProperty()
  modifiedTimestamp: number;
  @ApiProperty()
  confirmationsSubmitted: number;
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty()
  proposedBy: AddressInfo;
  @ApiProperty()
  confirmations: MessageConfirmation[];
  @ApiPropertyOptional()
  preparedSignature: string | null;

  constructor(
    messageHash: string,
    status: MessageStatus,
    logoUri: string | null,
    name: string | null,
    message: string | unknown,
    creationTimestamp: number,
    modifiedTimestamp: number,
    confirmationsSubmitted: number,
    confirmationsRequired: number,
    proposedBy: AddressInfo,
    confirmations: MessageConfirmation[],
    preparedSignature: string | null,
  ) {
    this.messageHash = messageHash;
    this.status = status;
    this.logoUri = logoUri;
    this.name = name;
    this.message = message;
    this.creationTimestamp = creationTimestamp;
    this.modifiedTimestamp = modifiedTimestamp;
    this.confirmationsSubmitted = confirmationsSubmitted;
    this.confirmationsRequired = confirmationsRequired;
    this.proposedBy = proposedBy;
    this.confirmations = confirmations;
    this.preparedSignature = preparedSignature;
  }
}
