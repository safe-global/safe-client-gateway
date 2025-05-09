import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  Erc20Token,
  Erc721Token,
  NativeToken,
} from '@/routes/balances/entities/token.entity';
import {
  ExecutionDetails,
  ExecutionDetailsType,
} from '@/routes/transactions/entities/transaction-details/execution-details.entity';

export class MultisigConfirmationDetails {
  @ApiProperty()
  signer: AddressInfo;
  @ApiPropertyOptional({ type: String, nullable: true })
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

@ApiExtraModels(NativeToken, Erc20Token, Erc721Token)
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
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  executor: AddressInfo | null;
  @ApiProperty({ type: AddressInfo, isArray: true })
  signers: Array<AddressInfo>;
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty({ type: MultisigConfirmationDetails, isArray: true })
  confirmations: Array<MultisigConfirmationDetails>;
  @ApiProperty({ type: AddressInfo, isArray: true })
  rejectors: Array<AddressInfo>;
  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(NativeToken) },
      { $ref: getSchemaPath(Erc20Token) },
      { $ref: getSchemaPath(Erc721Token) },
    ],
    nullable: true,
  })
  gasTokenInfo: NativeToken | Erc20Token | Erc721Token | null;
  @ApiProperty()
  trusted: boolean;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  proposer!: AddressInfo | null;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  proposedByDelegate!: AddressInfo | null;

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
    signers: Array<AddressInfo>,
    confirmationsRequired: number,
    confirmations: Array<MultisigConfirmationDetails>,
    rejectors: Array<AddressInfo>,
    gasTokenInfo: NativeToken | Erc20Token | Erc721Token | null,
    trusted: boolean,
    proposer: AddressInfo | null,
    proposedByDelegate: AddressInfo | null,
  ) {
    super(ExecutionDetailsType.Multisig);
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
    this.proposer = proposer;
    this.proposedByDelegate = proposedByDelegate;
  }
}
