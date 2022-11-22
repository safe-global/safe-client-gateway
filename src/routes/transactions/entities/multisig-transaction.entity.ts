import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Confirmation as DomainConfirmation,
  MultisigTransaction as DomainMultisigTransaction,
} from '../../../domain/safe/entities/multisig-transaction.entity';
import { Operation } from '../../../domain/safe/entities/operation.entity';

export class Confirmation implements DomainConfirmation {
  @ApiProperty()
  owner: string;
  @ApiProperty()
  submissionDate: Date;
  @ApiPropertyOptional()
  transactionHash?: string;
  @ApiProperty()
  signatureType: string;
  @ApiPropertyOptional()
  signature?: string;
}

export class MultisigTransaction implements DomainMultisigTransaction {
  @ApiProperty()
  safe: string;
  @ApiProperty()
  to: string;
  @ApiPropertyOptional()
  value?: string;
  @ApiPropertyOptional()
  data?: string;
  @ApiPropertyOptional()
  dataDecoded?: any;
  @ApiProperty()
  operation: Operation;
  @ApiPropertyOptional()
  gasToken?: string;
  @ApiPropertyOptional()
  safeTxGas?: number;
  @ApiPropertyOptional()
  baseGas?: number;
  @ApiPropertyOptional()
  gasPrice?: string;
  @ApiPropertyOptional()
  refundReceiver?: string;
  @ApiProperty()
  nonce: number;
  @ApiPropertyOptional()
  executionDate?: Date;
  @ApiPropertyOptional()
  submissionDate?: Date;
  @ApiPropertyOptional()
  modified?: Date;
  @ApiPropertyOptional()
  blockNumber?: number;
  @ApiPropertyOptional()
  transactionHash?: string;
  @ApiProperty()
  safeTxHash: string;
  @ApiPropertyOptional()
  executor?: string;
  @ApiProperty()
  isExecuted: boolean;
  @ApiPropertyOptional()
  isSuccessful?: boolean;
  @ApiPropertyOptional()
  ethGasPrice?: string;
  @ApiPropertyOptional()
  gasUsed?: number;
  @ApiPropertyOptional()
  fee?: string;
  @ApiPropertyOptional()
  origin?: string;
  @ApiPropertyOptional()
  confirmationsRequired?: number;
  @ApiPropertyOptional()
  confirmations?: DomainConfirmation[];
  @ApiPropertyOptional()
  signatures?: string;
}
