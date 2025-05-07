import { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import {
  Confirmation,
  MultisigTransaction as DomainMultisigTransaction,
} from '@/domain/safe/entities/multisig-transaction.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { ApiProperty } from '@nestjs/swagger';

export class TXSMultisigTransaction implements DomainMultisigTransaction {
  @ApiProperty()
  safe: `0x${string}`;
  @ApiProperty()
  to: `0x${string}`;
  @ApiProperty()
  value: string;
  @ApiProperty()
  data: `0x${string}` | null;
  @ApiProperty()
  operation: Operation;
  @ApiProperty()
  gasToken: `0x${string}` | null;
  @ApiProperty()
  safeTxGas: number | null;
  @ApiProperty()
  baseGas: number | null;
  @ApiProperty()
  gasPrice: string | null;
  @ApiProperty()
  proposer: `0x${string}` | null;
  @ApiProperty()
  proposedByDelegate: `0x${string}` | null;
  @ApiProperty()
  refundReceiver: `0x${string}` | null;
  @ApiProperty()
  nonce: number;
  @ApiProperty()
  executionDate: Date | null;
  @ApiProperty()
  submissionDate: Date;
  @ApiProperty()
  modified: Date | null;
  @ApiProperty()
  blockNumber: number | null;
  @ApiProperty()
  transactionHash: `0x${string}` | null;
  @ApiProperty()
  safeTxHash: `0x${string}`;
  @ApiProperty()
  executor: `0x${string}` | null;
  @ApiProperty()
  isExecuted: boolean;
  @ApiProperty()
  isSuccessful: boolean | null;
  @ApiProperty()
  ethGasPrice: string | null;
  @ApiProperty()
  gasUsed: number | null;
  @ApiProperty()
  fee: string | null;
  @ApiProperty()
  origin: string | null;
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty()
  confirmations: Array<Confirmation> | null;
  @ApiProperty()
  signatures: `0x${string}` | null;
  @ApiProperty()
  trusted: boolean;

  constructor(args: {
    safe: `0x${string}`;
    to: `0x${string}`;
    value: string;
    data: `0x${string}` | null;
    dataDecoded: DataDecoded | null;
    operation: Operation;
    gasToken: `0x${string}` | null;
    safeTxGas: number | null;
    baseGas: number | null;
    gasPrice: string | null;
    proposer: `0x${string}` | null;
    proposedByDelegate: `0x${string}` | null;
    refundReceiver: `0x${string}` | null;
    nonce: number;
    executionDate: Date | null;
    submissionDate: Date;
    modified: Date | null;
    blockNumber: number | null;
    transactionHash: `0x${string}` | null;
    safeTxHash: `0x${string}`;
    executor: `0x${string}` | null;
    isExecuted: boolean;
    isSuccessful: boolean | null;
    ethGasPrice: string | null;
    gasUsed: number | null;
    fee: string | null;
    origin: string | null;
    confirmationsRequired: number;
    confirmations: Array<Confirmation> | null;
    signatures: `0x${string}` | null;
    trusted: boolean;
  }) {
    this.safe = args.safe;
    this.to = args.to;
    this.value = args.value;
    this.data = args.data;
    this.operation = args.operation;
    this.gasToken = args.gasToken;
    this.safeTxGas = args.safeTxGas;
    this.baseGas = args.baseGas;
    this.gasPrice = args.gasPrice;
    this.proposer = args.proposer;
    this.proposedByDelegate = args.proposedByDelegate;
    this.refundReceiver = args.refundReceiver;
    this.nonce = args.nonce;
    this.executionDate = args.executionDate;
    this.submissionDate = args.submissionDate;
    this.modified = args.modified;
    this.blockNumber = args.blockNumber;
    this.transactionHash = args.transactionHash;
    this.safeTxHash = args.safeTxHash;
    this.executor = args.executor;
    this.isExecuted = args.isExecuted;
    this.isSuccessful = args.isSuccessful;
    this.ethGasPrice = args.ethGasPrice;
    this.gasUsed = args.gasUsed;
    this.fee = args.fee;
    this.origin = args.origin;
    this.confirmationsRequired = args.confirmationsRequired;
    this.confirmations = args.confirmations;
    this.signatures = args.signatures;
    this.trusted = args.trusted;
  }
}
