import { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import {
  Confirmation,
  MultisigTransaction as DomainMultisigTransaction,
} from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { Address, Hash, Hex } from 'viem';

export class TXSMultisigTransaction implements DomainMultisigTransaction {
  @ApiProperty()
  safe: Address;
  @ApiProperty()
  to: Address;
  @ApiProperty()
  value: string;
  @ApiProperty()
  data: Hex | null;
  @ApiProperty({
    enum: Operation,
    enumName: 'Operation',
    description: 'Operation type: 0 for CALL, 1 for DELEGATE',
  })
  operation: Operation;
  @ApiProperty()
  gasToken: Address | null;
  @ApiProperty()
  safeTxGas: number | null;
  @ApiProperty()
  baseGas: number | null;
  @ApiProperty()
  gasPrice: string | null;
  @ApiProperty()
  proposer: Address | null;
  @ApiProperty()
  proposedByDelegate: Address | null;
  @ApiProperty()
  refundReceiver: Address | null;
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
  transactionHash: Hash | null;
  @ApiProperty()
  safeTxHash: Hash;
  @ApiProperty()
  executor: Address | null;
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
  signatures: Hex | null;
  @ApiProperty()
  trusted: boolean;

  constructor(args: {
    safe: Address;
    to: Address;
    value: string;
    data: Hex | null;
    dataDecoded: DataDecoded | null;
    operation: Operation;
    gasToken: Address | null;
    safeTxGas: number | null;
    baseGas: number | null;
    gasPrice: string | null;
    proposer: Address | null;
    proposedByDelegate: Address | null;
    refundReceiver: Address | null;
    nonce: number;
    executionDate: Date | null;
    submissionDate: Date;
    modified: Date | null;
    blockNumber: number | null;
    transactionHash: Hash | null;
    safeTxHash: Hash;
    executor: Address | null;
    isExecuted: boolean;
    isSuccessful: boolean | null;
    ethGasPrice: string | null;
    gasUsed: number | null;
    fee: string | null;
    origin: string | null;
    confirmationsRequired: number;
    confirmations: Array<Confirmation> | null;
    signatures: Hex | null;
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
