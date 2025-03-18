import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MessageConfirmation } from '@/routes/messages/entities/message-confirmation.entity';

export enum MessageStatus {
  NeedsConfirmation = 'NEEDS_CONFIRMATION',
  Confirmed = 'CONFIRMED',
}

class TypedDataDomain {
  @ApiPropertyOptional({ nullable: true }) name?: string;
  @ApiPropertyOptional({ nullable: true }) version?: string;
  @ApiPropertyOptional({ nullable: true }) chainId?: unknown;
  @ApiPropertyOptional({ nullable: true }) verifyingContract?: string;
  @ApiPropertyOptional({ nullable: true }) salt?: string | Array<number>;
}

class TypedDataTypes {
  @ApiProperty() name: string;
  @ApiProperty() type: string;

  constructor(name: string, type: string) {
    this.name = name;
    this.type = type;
  }
}

type TypedMessageTypes = Record<string, Array<TypedDataTypes>>;

class EIP712TypedData {
  @ApiProperty({ type: () => TypedDataDomain })
  domain: TypedDataDomain;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { $ref: getSchemaPath(TypedDataTypes) },
    },
  })
  types: TypedMessageTypes;
  @ApiProperty({ type: 'object', additionalProperties: true })
  message: Record<string, unknown>;

  constructor(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataTypes>>,
    message: Record<string, unknown>,
  ) {
    this.domain = domain;
    this.types = types;
    this.message = message;
  }
}

@ApiExtraModels(EIP712TypedData, TypedDataTypes, TypedDataDomain)
export class Message {
  @ApiProperty()
  messageHash: `0x${string}`;
  @ApiProperty()
  status: MessageStatus;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  name: string | null;
  @ApiProperty({
    oneOf: [{ type: 'string' }, { $ref: getSchemaPath(EIP712TypedData) }],
  })
  message: string | Record<string, unknown>;
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
    message: string | Record<string, unknown>,
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
