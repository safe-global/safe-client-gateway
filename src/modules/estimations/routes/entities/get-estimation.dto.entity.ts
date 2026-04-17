import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type { GetEstimationDto as DomainGetEstimationDto } from '@/modules/estimations/domain/entities/get-estimation.dto.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

export class GetEstimationDto implements DomainGetEstimationDto {
  @ApiProperty()
  to!: Address;
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
}
