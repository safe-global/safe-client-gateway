import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { ProposeTransactionDto as DomainProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import type { Address, Hash, Hex } from 'viem';

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
}
