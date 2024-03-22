import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { ProposeTransactionDto as DomainProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';

export class ProposeTransactionDto implements DomainProposeTransactionDto {
  @ApiProperty()
  to!: `0x${string}`;
  @ApiProperty()
  value!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: `0x${string}` | null;
  @ApiProperty()
  nonce!: string;
  @ApiProperty()
  operation!: Operation;
  @ApiProperty()
  safeTxGas!: string;
  @ApiProperty()
  baseGas!: string;
  @ApiProperty()
  gasPrice!: string;
  @ApiProperty()
  gasToken!: `0x${string}`;
  @ApiPropertyOptional({ type: String, nullable: true })
  refundReceiver!: `0x${string}` | null;
  @ApiProperty()
  safeTxHash!: `0x${string}`;
  @ApiProperty()
  sender!: `0x${string}`;
  @ApiPropertyOptional({ type: String, nullable: true })
  signature!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  origin!: string | null;
}
