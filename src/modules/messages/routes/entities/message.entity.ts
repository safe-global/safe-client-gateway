// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Hash, Hex } from 'viem';
import { MessageConfirmation } from '@/modules/messages/routes/entities/message-confirmation.entity';
import { TypedData } from '@/modules/messages/routes/entities/typed-data.entity';
import { SafeAppInfo } from '@/modules/transactions/routes/entities/safe-app-info.entity';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';

export enum MessageStatus {
  NeedsConfirmation = 'NEEDS_CONFIRMATION',
  Confirmed = 'CONFIRMED',
}

@ApiExtraModels(TypedData)
export class Message {
  @ApiProperty()
  messageHash: Hash;
  @ApiProperty({ enum: MessageStatus })
  status: MessageStatus;
  /** @deprecated Read `safeAppInfo.logoUri` instead. */
  @ApiPropertyOptional({ type: String, nullable: true, deprecated: true })
  logoUri: string | null;
  /** @deprecated Read `safeAppInfo.name` instead. */
  @ApiPropertyOptional({ type: String, nullable: true, deprecated: true })
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
  preparedSignature: Hex | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  origin: string | null;
  @ApiPropertyOptional({ type: SafeAppInfo, nullable: true })
  safeAppInfo: SafeAppInfo | null;
  /** @deprecated Read `safeAppInfo.id` instead. */
  @ApiPropertyOptional({ type: Number, nullable: true, deprecated: true })
  safeAppId: number | null;

  constructor(
    messageHash: Hash,
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
    preparedSignature: Hex | null,
    origin: string | null,
    safeAppInfo: SafeAppInfo | null,
    safeAppId: number | null,
  ) {
    this.messageHash = messageHash;
    this.status = status;
    /* eslint-disable @typescript-eslint/no-deprecated -- legacy mirror fields populated for backward compatibility */
    this.logoUri = logoUri;
    this.name = name;
    /* eslint-enable @typescript-eslint/no-deprecated */
    this.message = message;
    this.creationTimestamp = creationTimestamp;
    this.modifiedTimestamp = modifiedTimestamp;
    this.confirmationsSubmitted = confirmationsSubmitted;
    this.confirmationsRequired = confirmationsRequired;
    this.proposedBy = proposedBy;
    this.confirmations = confirmations;
    this.preparedSignature = preparedSignature;
    this.origin = origin;
    this.safeAppInfo = safeAppInfo;
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy mirror of safeAppInfo.id
    this.safeAppId = safeAppId;
  }
}
