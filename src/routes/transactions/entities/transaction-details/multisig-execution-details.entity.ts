import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Token } from '../../../balances/entities/token.entity';
import { AddressInfo } from '../../../common/entities/address-info.entity';

export class MultisigConfirmationDetails {
  @ApiProperty()
  signer: AddressInfo;
  @ApiPropertyOptional()
  signature: string | null;
  @ApiProperty()
  submittedAt: number;

  constructor(
    signer: AddressInfo,
    signature: string | null,
    submittedAt: number,
  ) {
    this.signer = signer;
    this.signature = signature;
    this.submittedAt = submittedAt;
  }
}

export class MultisigExecutionDetails {
  @ApiProperty()
  submittedAt: number;
  @ApiProperty()
  nonce: number;
  @ApiProperty()
  safeTxGas: string;
  @ApiProperty()
  baseGas: string;
  @ApiProperty()
  gasPrice: string;
  @ApiProperty()
  gasToken: string;
  @ApiProperty()
  refundReceiver: AddressInfo;
  @ApiProperty()
  safeTxHash: string;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  executor: AddressInfo | null;
  @ApiProperty()
  signers: AddressInfo[];
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty()
  confirmations: MultisigConfirmationDetails[];
  @ApiPropertyOptional({ type: AddressInfo, isArray: true, nullable: true })
  rejectors: AddressInfo[] | null;
  @ApiPropertyOptional({ type: Token, nullable: true })
  gasTokenInfo: Token | null;
  @ApiProperty()
  trusted: boolean;
}
