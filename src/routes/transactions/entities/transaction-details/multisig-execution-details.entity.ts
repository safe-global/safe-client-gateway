import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Token } from '../../../balances/entities/token.entity';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { ExecutionDetails } from './execution-details.entity';

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

export class MultisigExecutionDetails extends ExecutionDetails {
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

  constructor(
    submittedAt: number,
    nonce: number,
    safeTxGas: string,
    baseGas: string,
    gasPrice: string,
    gasToken: string,
    refundReceiver: AddressInfo,
    safeTxHash: string,
    executor: AddressInfo | null,
    signers: AddressInfo[],
    confirmationsRequired: number,
    confirmations: MultisigConfirmationDetails[],
    rejectors: AddressInfo[] | null,
    gasTokenInfo: Token | null,
    trusted: boolean,
  ) {
    super('MULTISIG');
    this.submittedAt = submittedAt;
    this.nonce = nonce;
    this.safeTxGas = safeTxGas;
    this.baseGas = baseGas;
    this.gasPrice = gasPrice;
    this.gasToken = gasToken;
    this.refundReceiver = refundReceiver;
    this.safeTxHash = safeTxHash;
    this.executor = executor;
    this.signers = signers;
    this.confirmationsRequired = confirmationsRequired;
    this.confirmations = confirmations;
    this.rejectors = rejectors;
    this.gasTokenInfo = gasTokenInfo;
    this.trusted = trusted;
  }
}
