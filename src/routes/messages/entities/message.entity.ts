import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MessageConfirmation } from '@/routes/messages/entities/message-confirmation.entity';
import { TypedData } from '@/routes/messages/entities/typed-data.entity';

export enum MessageStatus {
  NeedsConfirmation = 'NEEDS_CONFIRMATION',
  Confirmed = 'CONFIRMED',
}

@ApiExtraModels(TypedData)
export class Message {
  @ApiProperty()
  messageHash: `0x${string}`;
  @ApiProperty({ enum: MessageStatus })
  status: MessageStatus;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  name: string | null;
  @ApiProperty({
    oneOf: [{ type: 'string' }, { $ref: getSchemaPath(TypedData) }],
  })
  message: string | TypedData;
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
  @ApiProperty({ type: MessageConfirmation, isArray: true })
  confirmations: Array<MessageConfirmation>;
  @ApiPropertyOptional({ type: String, nullable: true })
  preparedSignature: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  origin: string | null;

  constructor(
    messageHash: `0x${string}`,
    status: MessageStatus,
    logoUri: string | null,
    name: string | null,
    message: string | TypedData,
    creationTimestamp: number,
    modifiedTimestamp: number,
    confirmationsSubmitted: number,
    confirmationsRequired: number,
    proposedBy: AddressInfo,
    confirmations: Array<MessageConfirmation>,
    preparedSignature: `0x${string}` | null,
    origin: string | null,
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
    this.origin = origin;
  }
}
