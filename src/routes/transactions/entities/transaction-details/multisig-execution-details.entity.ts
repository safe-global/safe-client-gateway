import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { Token } from '@/routes/balances/entities/token.entity';
import {
  ExecutionDetails,
  ExecutionDetailsType,
} from '@/routes/transactions/entities/transaction-details/execution-details.entity';

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
  @ApiProperty({ enum: [ExecutionDetailsType.Multisig] })
  override type = ExecutionDetailsType.Multisig;
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
  @ApiPropertyOptional({ nullable: true })
  domainHash: `0x${string}` | null;
  @ApiPropertyOptional({ nullable: true })
  messageHash: `0x${string}` | null;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  executor: AddressInfo | null;
  @ApiProperty()
  signers: AddressInfo[];
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty()
  confirmations: MultisigConfirmationDetails[];
  @ApiProperty({ type: AddressInfo, isArray: true })
  rejectors: AddressInfo[];
  @ApiPropertyOptional({ type: Token, nullable: true })
  gasTokenInfo: Token | null;
  @ApiProperty()
  trusted: boolean;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  proposer!: AddressInfo | null;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  proposedByDelegate!: AddressInfo | null;

  constructor(args: {
    submittedAt: number;
    nonce: number;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: string;
    refundReceiver: AddressInfo;
    safeTxHash: string;
    domainHash: `0x${string}` | null;
    messageHash: `0x${string}` | null;
    executor: AddressInfo | null;
    signers: AddressInfo[];
    confirmationsRequired: number;
    confirmations: MultisigConfirmationDetails[];
    rejectors: AddressInfo[];
    gasTokenInfo: Token | null;
    trusted: boolean;
    proposer: AddressInfo | null;
    proposedByDelegate: AddressInfo | null;
  }) {
    super(ExecutionDetailsType.Multisig);
    this.submittedAt = args.submittedAt;
    this.nonce = args.nonce;
    this.safeTxGas = args.safeTxGas;
    this.baseGas = args.baseGas;
    this.gasPrice = args.gasPrice;
    this.gasToken = args.gasToken;
    this.refundReceiver = args.refundReceiver;
    this.safeTxHash = args.safeTxHash;
    this.domainHash = args.domainHash;
    this.messageHash = args.messageHash;
    this.executor = args.executor;
    this.signers = args.signers;
    this.confirmationsRequired = args.confirmationsRequired;
    this.confirmations = args.confirmations;
    this.rejectors = args.rejectors;
    this.gasTokenInfo = args.gasTokenInfo;
    this.trusted = args.trusted;
    this.proposer = args.proposer;
    this.proposedByDelegate = args.proposedByDelegate;
  }
}
