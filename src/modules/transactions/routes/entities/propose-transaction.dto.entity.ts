// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address, Hash, Hex } from 'viem';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type {
  NestedTransactionDto as DomainNestedTransactionDto,
  ProposeTransactionDto as DomainProposeTransactionDto,
} from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';

export class NestedTransactionDto implements DomainNestedTransactionDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  to!: Address | null;
  @ApiProperty()
  value!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: Hex | null;
  @ApiProperty({
    enum: Operation,
    enumName: 'Operation',
    description: 'Operation type: 0 for CALL, 1 for DELEGATE',
  })
  operation!: Operation;
  @ApiProperty()
  safeTxGas!: string;
  @ApiProperty()
  baseGas!: string;
  @ApiProperty()
  gasPrice!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  gasToken!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  refundReceiver!: Address | null;
  @ApiProperty({ description: "The nested Safe's nonce" })
  nonce!: string;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  notes!: string | null;
}

export class ProposeTransactionDto implements DomainProposeTransactionDto {
  @ApiProperty()
  to!: Address;
  @ApiProperty()
  value!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: Hex | null;
  @ApiProperty()
  nonce!: string;
  @ApiProperty({
    enum: Operation,
    enumName: 'Operation',
    description: 'Operation type: 0 for CALL, 1 for DELEGATE',
  })
  operation!: Operation;
  @ApiProperty()
  safeTxGas!: string;
  @ApiProperty()
  baseGas!: string;
  @ApiProperty()
  gasPrice!: string;
  @ApiProperty()
  gasToken!: Address;
  @ApiPropertyOptional({ type: String, nullable: true })
  refundReceiver!: Address | null;
  @ApiProperty()
  safeTxHash!: Hash;
  @ApiProperty()
  sender!: Address;
  @ApiPropertyOptional({ type: String, nullable: true })
  signature!: Hex | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  origin!: string | null;
  @ApiPropertyOptional({
    type: NestedTransactionDto,
    nullable: true,
    description:
      'A child transaction for a second Safe, authorised by the parent transaction being an `approveHash` call committing to its hash. Unknown keys are rejected.',
  })
  nestedTransaction!: NestedTransactionDto | null;
}
